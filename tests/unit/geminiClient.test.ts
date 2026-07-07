const mockCreate = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    interactions: { create: mockCreate },
  })),
}));

import { runFanAssistantTurn, runSimpleCompletion } from '../../src/ai/geminiClient';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('runFanAssistantTurn', () => {
  it('returns the final text directly when the model makes no tool call', async () => {
    mockCreate.mockResolvedValueOnce({ output_text: 'Hello fan!', steps: [] });

    const result = await runFanAssistantTurn('system prompt', 'hi there');

    expect(result.finalText).toBe('Hello fan!');
    expect(result.toolCalls).toHaveLength(0);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('executes a requested tool and sends the result back for a final answer', async () => {
    mockCreate
      .mockResolvedValueOnce({
        output_text: '',
        steps: [{ type: 'function_call', id: 'call_1', name: 'list_venues', arguments: {} }],
      })
      .mockResolvedValueOnce({ output_text: 'Here are the venues.', steps: [] });

    const result = await runFanAssistantTurn('system prompt', 'list all venues');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.finalText).toBe('Here are the venues.');
    expect(result.toolCalls).toEqual([{ name: 'list_venues', args: {}, ok: true }]);

    const secondCallArgs = mockCreate.mock.calls[1][0];
    const hasFunctionResultStep = (secondCallArgs.input as Array<{ type: string }>).some(
      (step) => step.type === 'function_result',
    );
    expect(hasFunctionResultStep).toBe(true);
  });

  it('records a failed tool call without crashing, using the tool error message', async () => {
    mockCreate
      .mockResolvedValueOnce({
        output_text: '',
        steps: [{ type: 'function_call', id: 'call_2', name: 'get_gate_status', arguments: { venueId: 'nope' } }],
      })
      .mockResolvedValueOnce({ output_text: 'That venue does not exist.', steps: [] });

    const result = await runFanAssistantTurn('system prompt', 'gate status for nope');

    expect(result.toolCalls).toEqual([{ name: 'get_gate_status', args: { venueId: 'nope' }, ok: false }]);
    expect(result.finalText).toBe('That venue does not exist.');
  });

  it('stops after the maximum number of tool rounds and throws if still no final text', async () => {
    mockCreate.mockResolvedValue({
      output_text: '',
      steps: [{ type: 'function_call', id: 'call_x', name: 'list_venues', arguments: {} }],
    });

    await expect(runFanAssistantTurn('system prompt', 'loop forever')).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});

describe('runSimpleCompletion', () => {
  it('returns the output text for a plain completion', async () => {
    mockCreate.mockResolvedValueOnce({ output_text: 'Briefing text.' });
    const text = await runSimpleCompletion('system prompt', 'live data');
    expect(text).toBe('Briefing text.');
  });

  it('throws when the model returns no usable text', async () => {
    mockCreate.mockResolvedValueOnce({ output_text: '' });
    await expect(runSimpleCompletion('system prompt', 'live data')).rejects.toThrow();
  });
});
