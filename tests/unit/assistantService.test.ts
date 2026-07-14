const mockIsGeminiConfigured = jest.fn();
const mockRunFanAssistantTurn = jest.fn();
const mockRunSimpleCompletion = jest.fn();

jest.mock('../../src/config/env', () => ({
  isGeminiConfigured: () => mockIsGeminiConfigured(),
}));

jest.mock('../../src/ai/geminiClient', () => ({
  runFanAssistantTurn: (...args: unknown[]) => mockRunFanAssistantTurn(...args),
  runSimpleCompletion: (...args: unknown[]) => mockRunSimpleCompletion(...args),
}));

import { getAssistantReply, getOpsInsight } from '../../src/ai/assistantService';

beforeEach(() => {
  mockIsGeminiConfigured.mockReset();
  mockRunFanAssistantTurn.mockReset();
  mockRunSimpleCompletion.mockReset();
});

describe('getAssistantReply', () => {
  it('uses the deterministic fallback engine when Gemini is not configured', async () => {
    mockIsGeminiConfigured.mockReturnValue(false);

    const result = await getAssistantReply('Which gate at AT&T Stadium Dallas has the shortest wait?');

    expect(result.mode).toBe('fallback');
    expect(result.reply.length).toBeGreaterThan(0);
    expect(mockRunFanAssistantTurn).not.toHaveBeenCalled();
  });

  it('uses Gemini when configured and the call succeeds', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);
    mockRunFanAssistantTurn.mockResolvedValue({ finalText: 'Gate B is your best option.', toolCalls: [] });

    const result = await getAssistantReply('Where should I go?');

    expect(result.mode).toBe('gemini');
    expect(result.reply).toBe('Gate B is your best option.');
  });

  it('degrades gracefully to the fallback engine when the Gemini call throws', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);
    mockRunFanAssistantTurn.mockRejectedValue(new Error('network down'));

    const result = await getAssistantReply('Which gate at Gillette Stadium Boston is quietest?');

    expect(result.mode).toBe('fallback');
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('passes trimmed conversation history through to Gemini', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);
    mockRunFanAssistantTurn.mockResolvedValue({ finalText: 'Sure thing.', toolCalls: [] });

    const longHistory = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      text: `turn ${i}`,
    }));

    await getAssistantReply('follow up question', longHistory);

    const [, combinedInput] = mockRunFanAssistantTurn.mock.calls[0];
    // Only the most recent turns should appear; the earliest ones should be dropped.
    expect(combinedInput).not.toContain('turn 0');
    expect(combinedInput).toContain('follow up question');
  });
});

describe('getOpsInsight', () => {
  it('returns a clear error briefing for an unknown venue without calling Gemini', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);

    const result = await getOpsInsight('not-a-real-venue');

    expect(result.mode).toBe('fallback');
    expect(result.briefing[0]).toMatch(/Unknown venue/);
    expect(mockRunSimpleCompletion).not.toHaveBeenCalled();
  });

  it('uses the deterministic briefing generator when Gemini is not configured', async () => {
    mockIsGeminiConfigured.mockReturnValue(false);

    const result = await getOpsInsight('att-dallas');

    expect(result.mode).toBe('fallback');
    expect(result.briefing.length).toBeGreaterThan(0);
  });

  it('uses Gemini for the briefing when configured and successful', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);
    mockRunSimpleCompletion.mockResolvedValue('- Gate A is crowded\n- Redirect to Gate C');

    const result = await getOpsInsight('att-dallas');

    expect(result.mode).toBe('gemini');
    expect(result.briefing).toEqual(['Gate A is crowded', 'Redirect to Gate C']);
  });

  it('degrades to the deterministic briefing when the Gemini call throws', async () => {
    mockIsGeminiConfigured.mockReturnValue(true);
    mockRunSimpleCompletion.mockRejectedValue(new Error('timeout'));

    const result = await getOpsInsight('att-dallas');

    expect(result.mode).toBe('fallback');
    expect(result.briefing.length).toBeGreaterThan(0);
  });
});
