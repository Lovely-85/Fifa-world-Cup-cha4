import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { executeTool, TOOL_DECLARATIONS } from './tools';
import { logger } from '../utils/logger';

/**
 * Thin, testable wrapper around the Gemini API's Interactions endpoint
 * (client.interactions.create), implementing the documented stateless
 * function-calling loop: https://ai.google.dev/gemini-api/docs/function-calling
 *
 * Design choices, both deliberate:
 *  - `store: false` on every call: no fan conversation is retained on
 *    Google's servers, even transiently. That is a meaningful privacy
 *    default for a public event assistant.
 *  - A hard timeout + a bounded number of tool-call rounds: an external AI
 *    API call must never be allowed to hang a request indefinitely or loop
 *    forever, regardless of what the model decides to do.
 */

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_TOOL_ROUNDS = 3;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

interface InteractionStep {
  type: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  [key: string]: unknown;
}

interface InteractionLike {
  output_text?: string;
  steps?: InteractionStep[];
}

/**
 * Local mirror of the slice of the Gemini Interactions API's step
 * wire-format this project actually constructs or reads.
 *
 * As of @google/genai@2.10.0, the SDK's own `Step`/`Tool` request types are
 * internal implementation details, not part of its public type export
 * surface (verified directly against the vendored
 * node_modules/@google/genai/dist/node/node.d.ts -- there is no exported
 * `Step` or `Tool` symbol to import). Rather than typing the conversation
 * history as a blanket `any` -- which the Google TypeScript Style Guide
 * (google.github.io/styleguide/tsguide.html) specifically calls out as
 * unsafe, since it silences the compiler without any runtime check -- this
 * type gives every step a precise, locally-verified shape. The single
 * unavoidable cast to the SDK's own wider parameter type is isolated to one
 * commented line in callInteractions() below, rather than spread across the
 * module.
 */
interface TextBlock {
  type: 'text';
  text: string;
}

interface UserInputStep {
  type: 'user_input';
  content: TextBlock[];
}

interface FunctionResultRequestStep {
  type: 'function_result';
  name: string;
  call_id: string;
  is_error: boolean;
  result: TextBlock[];
}

type ConversationStep = UserInputStep | FunctionResultRequestStep | InteractionStep;

function extractFinalText(interaction: InteractionLike): string {
  if (interaction.output_text && interaction.output_text.trim().length > 0) {
    return interaction.output_text.trim();
  }
  // Defense-in-depth fallback: output_text is documented as SDK-added, but
  // if a future SDK version ever omits it, reconstruct from model_output
  // step content blocks rather than failing outright.
  const textFromSteps = (interaction.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join(' ')
    .trim();
  return textFromSteps;
}

export interface ToolCallLogEntry {
  name: string;
  args: unknown;
  ok: boolean;
}

export interface GeminiRunResult {
  finalText: string;
  toolCalls: ToolCallLogEntry[];
}

/**
 * The SDK's own parameter type for `interactions.create()`, derived
 * directly from its declared method signature via TypeScript's `Parameters`
 * utility rather than hand-typed. This keeps the one necessary boundary
 * cast (see `callInteractions` below) tied to whatever the installed SDK
 * version actually declares, instead of a static guess that could silently
 * drift from a future `@google/genai` upgrade.
 */
type InteractionsCreateParams = Parameters<GoogleGenAI['interactions']['create']>[0];

interface CreateInteractionOptions {
  systemInstruction: string;
  input: string | ConversationStep[];
  withTools: boolean;
}

/**
 * The one place in this module that talks to the SDK's `create()` method.
 * Isolating the call here means the not-publicly-typed request shape needs
 * exactly one justified, commented cast (see below), instead of `any`
 * leaking into every function that needs to make a Gemini call.
 */
async function callInteractions(options: CreateInteractionOptions): Promise<InteractionLike> {
  const ai = getClient();
  const params = {
    model: env.GEMINI_MODEL,
    store: false,
    system_instruction: options.systemInstruction,
    input: options.input,
    ...(options.withTools ? { tools: TOOL_DECLARATIONS } : {}),
  };

  // `ConversationStep`/`TOOL_DECLARATIONS` above are this project's own
  // precise, hand-verified mirror of the Interactions API wire format (see
  // the comment on ConversationStep). The SDK's request-side `Step`/`Tool`
  // types are not part of its public export surface as of
  // @google/genai@2.10.0, so a single cast to the SDK's own declared
  // parameter type is the trust boundary -- not a loosely-typed `any`.
  const sdkParams = params as unknown as InteractionsCreateParams;

  return withTimeout(
    ai.interactions.create(sdkParams),
    REQUEST_TIMEOUT_MS,
    'Gemini interactions.create',
  ) as Promise<InteractionLike>;
}

/**
 * Runs one fan message through Gemini with tool-calling enabled, executing
 * up to MAX_TOOL_ROUNDS rounds of function calls before forcing a final
 * answer. `combinedInput` should already include any prior-turn context the
 * caller wants the model to see (see assistantService for how that rolling
 * transcript is built) -- this function only concerns itself with the
 * single-turn tool loop mechanics.
 */
export async function runFanAssistantTurn(
  systemInstruction: string,
  combinedInput: string,
): Promise<GeminiRunResult> {
  const toolCalls: ToolCallLogEntry[] = [];

  let history: ConversationStep[] = [
    { type: 'user_input', content: [{ type: 'text', text: combinedInput }] },
  ];
  let interaction: InteractionLike | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    interaction = await callInteractions({ systemInstruction, input: history, withTools: true });

    history = [...history, ...(interaction.steps ?? [])];

    const functionCallSteps = (interaction.steps ?? []).filter((step) => step.type === 'function_call');
    if (functionCallSteps.length === 0) {
      break;
    }

    for (const step of functionCallSteps) {
      const toolName = step.name ?? 'unknown_tool';
      const result = executeTool(toolName, step.arguments);
      toolCalls.push({ name: toolName, args: step.arguments, ok: result.ok });
      if (!result.ok) {
        logger.warn('Tool execution returned an error', { tool: toolName, error: result.error });
      }
      history.push({
        type: 'function_result',
        name: toolName,
        call_id: step.id ?? step.call_id ?? toolName,
        is_error: !result.ok,
        result: [{ type: 'text', text: JSON.stringify(result.ok ? result.data : { error: result.error }) }],
      });
    }
  }

  const finalText = interaction ? extractFinalText(interaction) : '';
  if (!finalText) {
    throw new Error('Gemini returned no final text after the tool-calling loop.');
  }

  return { finalText, toolCalls };
}

/**
 * A single-shot completion with no tool access, used for the staff Ops
 * Insight briefing where the caller has already gathered all relevant live
 * data itself and only needs it summarized into a short staff briefing.
 */
export async function runSimpleCompletion(systemInstruction: string, input: string): Promise<string> {
  const interaction = await callInteractions({ systemInstruction, input, withTools: false });

  const text = extractFinalText(interaction);
  if (!text) {
    throw new Error('Gemini returned no final text for the simple completion.');
  }
  return text;
}
