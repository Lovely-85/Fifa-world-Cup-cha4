/**
 * @fileoverview POST /api/chat -- the fan-facing conversational endpoint.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validateRequest';
import { chatRateLimiter } from '../middleware/security';
import { getAssistantReply } from '../ai/assistantService';
import { flagPotentialPromptInjection, truncate } from '../utils/sanitize';
import { logger } from '../utils/logger';

const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(2000),
});

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, 'message must not be empty').max(2000, 'message is too long'),
  history: z.array(chatTurnSchema).max(12).optional().default([]),
});

export const chatRouter = Router();

chatRouter.post('/', chatRateLimiter, validateBody(chatRequestSchema), async (req, res, next) => {
  try {
    const { message, history } = req.body as z.infer<typeof chatRequestSchema>;

    if (flagPotentialPromptInjection(message)) {
      // Logged only -- never used to silently alter behaviour. See SECURITY.md.
      logger.warn('Potential prompt-injection pattern detected in chat message', {
        preview: truncate(message, 120),
      });
    }

    const result = await getAssistantReply(message, history);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
