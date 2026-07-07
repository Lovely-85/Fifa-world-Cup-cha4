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
  const ai = getClient();
  const toolCalls: ToolCallLogEntry[] = [];

  let history: any[] = [{ type: 'user_input', content: [{ type: 'text', text: combinedInput }] }]; // eslint-disable-line @typescript-eslint/no-explicit-any
  let interaction: InteractionLike | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    interaction = (await withTimeout(
      ai.interactions.create({
        model: env.GEMINI_MODEL,
        store: false,
        system_instruction: systemInstruction,
        input: history,
        tools: TOOL_DECLARATIONS as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
      REQUEST_TIMEOUT_MS,
      'Gemini interactions.create',
    )) as InteractionLike;

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
  const ai = getClient();
  const interaction = (await withTimeout(
    ai.interactions.create({
      model: env.GEMINI_MODEL,
      store: false,
      system_instruction: systemInstruction,
      input,
    }),
    REQUEST_TIMEOUT_MS,
    'Gemini interactions.create',
  )) as InteractionLike;

  const text = extractFinalText(interaction);
  if (!text) {
    throw new Error('Gemini returned no final text for the simple completion.');
  }
  return text;
}
