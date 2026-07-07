import { isGeminiConfigured } from '../config/env';
import { runFanAssistantTurn, runSimpleCompletion } from './geminiClient';
import { generateFallbackOpsBriefing, generateFallbackResponse } from './fallbackEngine';
import { FAN_ASSISTANT_SYSTEM_PROMPT, OPS_INSIGHT_SYSTEM_PROMPT } from './systemPrompt';
import { logger } from '../utils/logger';
import { findVenue } from '../data/venues';
import { getTransportSnapshot, getVenueGateSnapshots, isHeatAdvisoryActive } from '../data/liveState';

/**
 * Orchestration layer. This is the ONLY module the HTTP routes talk to for
 * AI behaviour, and it is deliberately responsible for the
 * Gemini-unavailable / Gemini-failed graceful degradation, so that failure
 * mode lives in exactly one place rather than being duplicated per route.
 */

export type AssistantMode = 'gemini' | 'fallback';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantReply {
  reply: string;
  mode: AssistantMode;
}

const MAX_HISTORY_TURNS = 6;

function buildCombinedInput(userMessage: string, history: ChatTurn[]): string {
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);
  const transcript = trimmedHistory
    .map((turn) => `${turn.role === 'user' ? 'Fan' : 'Assistant'}: ${turn.text}`)
    .join('\n');
  const transcriptBlock = transcript ? `Conversation so far:\n${transcript}\n\n` : '';
  return `${transcriptBlock}FAN MESSAGE:\n${userMessage}`;
}

export async function getAssistantReply(userMessage: string, history: ChatTurn[] = []): Promise<AssistantReply> {
  if (isGeminiConfigured()) {
    try {
      const combinedInput = buildCombinedInput(userMessage, history);
      const result = await runFanAssistantTurn(FAN_ASSISTANT_SYSTEM_PROMPT, combinedInput);
      return { reply: result.finalText, mode: 'gemini' };
    } catch (error) {
      logger.error('Gemini call failed; degrading to fallback engine', {
        error: (error as Error).message,
      });
    }
  }

  const fallback = generateFallbackResponse(userMessage);
  return { reply: fallback.finalText, mode: 'fallback' };
}

export interface OpsInsight {
  briefing: string[];
  mode: AssistantMode;
}

function buildOpsDataSummary(venueId: string): string {
  const venue = findVenue(venueId);
  const gates = getVenueGateSnapshots(venueId);
  const transport = getTransportSnapshot(venueId);
  const heat = isHeatAdvisoryActive(venueId);

  const gateLines = gates
    .map((g) => `Gate ${g.gateId}: ${g.densityLevel} density (${g.densityPct}%), ${g.waitMinutes}min wait, elevator ${g.elevatorOperational ? 'operational' : 'down'}`)
    .join('\n');

  return [
    `Venue: ${venue?.name ?? venueId}`,
    'LIVE DATA:',
    gateLines,
    transport
      ? `Transport: shuttle ETA ${transport.shuttleEtaMinutes}min, parking ${transport.parkingOccupancyPct}% full, transit ${transport.transitStatus}`
      : 'Transport: unavailable',
    `Heat/altitude advisory active: ${heat}`,
  ].join('\n');
}

function parseBriefingToBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);
}

export async function getOpsInsight(venueId: string): Promise<OpsInsight> {
  if (!findVenue(venueId)) {
    return { briefing: [`Unknown venue "${venueId}".`], mode: 'fallback' };
  }

  if (isGeminiConfigured()) {
    try {
      const summary = buildOpsDataSummary(venueId);
      const text = await runSimpleCompletion(OPS_INSIGHT_SYSTEM_PROMPT, summary);
      return { briefing: parseBriefingToBullets(text), mode: 'gemini' };
    } catch (error) {
      logger.error('Gemini ops-insight call failed; degrading to fallback engine', {
        error: (error as Error).message,
      });
    }
  }

  return { briefing: generateFallbackOpsBriefing(venueId), mode: 'fallback' };
}
