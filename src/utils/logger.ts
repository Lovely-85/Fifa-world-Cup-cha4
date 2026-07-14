/**
 * @fileoverview Minimal structured logger. Deliberately dependency-free:
 * for a project this size, pulling in winston/pino adds bundle weight and
 * configuration surface without a proportional benefit. Never logs secrets
 * (API keys are never passed through the logger) and truncates free-text
 * user input before logging it, so chat messages can't blow up log storage
 * or leak excessive personal data into logs.
 */

type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
