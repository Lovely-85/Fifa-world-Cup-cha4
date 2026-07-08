# Security

This document explains the threat model and the concrete mitigations in this codebase. It is organized around the [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) where relevant, plus standard web-application hardening.

## LLM-specific risks

### LLM01: Prompt Injection

**The primary defense is structural, not a keyword filter.** A fan's message is never string-concatenated into the system prompt; it is passed as its own `user_input` step, clearly labeled `FAN MESSAGE:` in the combined turn text, with an explicit instruction in the system prompt (`src/ai/systemPrompt.ts`) that everything after that label is data from a stadium visitor, never a new instruction. The model is told to decline requests to reveal the system prompt, change role, or act outside stadium-assistant guidance.

**The model's entire capability surface is a fixed, read-only tool allowlist** (`src/ai/tools.ts`): seven functions, each backed by `zod` schema validation of every model-supplied argument before it touches any application logic. There is no filesystem, network, shell, or database access exposed to the model at all — so even a fully "jailbroken" model response has no dangerous action available to it. This is the load-bearing defense; it holds regardless of how creative the injected text is.

**A lightweight heuristic detector** (`flagPotentialPromptInjection` in `src/utils/sanitize.ts`) flags common jailbreak phrasing for server-side logging only. It is intentionally never used to silently alter model behaviour — naive keyword blocking is trivial to evade and would provide a false sense of security without the structural defenses above.

### LLM02: Insecure Output Handling

Model output is only ever rendered client-side via `element.textContent` (`public/app.js`, `public/ops.js`), never `innerHTML` or `eval`. This closes off DOM-based XSS by construction — there is no code path where model text is parsed as HTML or executed as script, so no amount of adversarial model output can inject a script tag. `escapeHtml` (`src/utils/sanitize.ts`) is additionally provided and unit-tested as defense-in-depth for any future HTML-templating context.

### LLM04: Model Denial of Service

Every Gemini call has a 12-second timeout and the tool-calling loop is capped at 3 rounds (`src/ai/geminiClient.ts`), so a slow or looping model interaction can never hang a request indefinitely. `/api/chat` is additionally rate-limited per IP (`express-rate-limit`, default 20/minute, configurable via `CHAT_RATE_LIMIT_PER_MINUTE`) to bound both abuse and Gemini API cost.

### LLM06 / data minimization: conversation privacy

Every Gemini call sets `store: false`. No fan conversation is retained on Google's servers, even transiently — the assistant is stateless by design, and each request carries only the short rolling transcript the client explicitly sends (capped to the last 6 turns). This was a deliberate trade-off (see README §4): it costs a little request-size overhead in exchange for not accumulating a server-side or third-party store of what fans asked about their location, mobility needs, or plans.

## Standard web-application hardening

- **Strict CSP** (`helmet`, `src/middleware/security.ts`): `default-src 'self'` with no wildcard script/style/image origins and no inline script execution, since the app serves only its own static assets.
- **CORS allowlist**: origins are explicitly configured via `ALLOWED_ORIGINS`, not `*`, for any deployment beyond local demo use.
- **Input validation everywhere**: every request body and route param is validated with `zod` (`src/middleware/validateRequest.ts`) before reaching a handler — malformed input is rejected with a 400 and never reaches business logic or the AI layer.
- **Bounded request size**: `express.json({ limit: '32kb' })` prevents oversized-payload abuse.
- **No secrets in the client**: `GEMINI_API_KEY` is read only server-side (`src/config/env.ts`) and is never sent to, or readable by, the browser.
- **Fail-safe environment validation**: all configuration is parsed and validated once at startup with `zod` (`src/config/env.ts`); the process refuses to start with an invalid configuration rather than running in an undefined state.
- **No internal error leakage**: the centralized error handler (`src/middleware/errorHandler.ts`) logs full error details server-side but only ever returns a generic message to the client (with a `debug` field enabled outside `NODE_ENV=production`, never in production).
- **Dependency hygiene**: `npm install` was run against the current registry with `npm audit` reporting 0 vulnerabilities at submission time; the dependency list is deliberately small (8 runtime dependencies).

## Reporting

This is a hackathon submission with no production deployment or user data; there is no separate disclosure process. For questions, open an issue on the repository.
