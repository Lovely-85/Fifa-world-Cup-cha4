/**
 * @fileoverview Security-focused text utilities.
 *
 * These are defense-in-depth measures, not a substitute for the structural
 * defenses that matter most: keeping user text in its own message role
 * (never string-concatenated into the system prompt) and giving the model
 * a fixed, schema-validated tool allowlist with no filesystem/network/shell
 * access (see src/ai/tools.ts). See SECURITY.md for the full threat model.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes HTML-significant characters. Used before any AI or user text is ever
 * rendered via innerHTML on the client, and defensively on the server too. */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}…`;
}

/**
 * Heuristic-only detector for common prompt-injection / jailbreak phrasing,
 * e.g. "ignore previous instructions", "reveal your system prompt".
 *
 * IMPORTANT: this is used purely for logging/telemetry so suspicious traffic
 * can be reviewed later. It is intentionally NOT used to silently alter or
 * block model behaviour, because naive keyword blocking is trivial to evade
 * and gives a false sense of security. The real defense is structural (role
 * separation + tool allowlist), as described above.
 */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /reveal (your |the )?(system|hidden) prompt/i,
  /you are now (in )?(developer|debug|god) mode/i,
  /disregard (your|all) (rules|guidelines|instructions)/i,
  /act as if you have no (restrictions|rules|filters)/i,
];

export function flagPotentialPromptInjection(input: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(input));
}
