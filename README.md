# FIFA World Cup 2026 Fan Assistant

![CI](https://github.com/SriRamkunamsetty/worldcup-fan-assistant/actions/workflows/ci.yml/badge.svg)

A multilingual, accessibility-first, GenAI-powered navigation and crowd-safety assistant for fans at any of the 16 FIFA World Cup 2026 host venues — with a secondary staff/volunteer **Ops Insight** view that reuses the same reasoning engine for real-time operational intelligence.

Built for the **Smart Stadiums & Tournament Operations** PromptWars challenge.

---

## 1. Chosen vertical

**Primary vertical:** Real-time, context-aware navigation and crowd-safety assistance, built specifically to be **multilingual** and **accessibility-first**.

**Persona:** An international fan on their phone, mid-concourse, who needs a fast, confident answer — "which gate right now," "how do I get in with a wheelchair," "how do I get here without a car" — not a chatbot to browse.

**Why this vertical, and why one persona:** the brief asks for one vertical and one persona, not a checklist. Rather than bolting on eight disconnected features, this solution treats navigation as the spine and lets accessibility, transportation, sustainability, and operational intelligence fall out of the *same* context-aware reasoning loop, because in practice they're the same problem: "given this fan, this moment, and this venue's live state, what should they do right now?" A secondary **Ops Insight** page reuses that identical reasoning engine from the staff/volunteer side, so operational intelligence isn't a bolted-on feature either — it's the same brain, different audience.

### Problem-statement alignment map

| Brief capability | How this solution addresses it |
|---|---|
| Navigation | `get_least_crowded_gate` / `get_gate_status` tools give a specific gate recommendation, grounded in live (simulated) density data |
| Crowd management | Every gate's live density/wait feeds both the fan chat and the staff Ops Insight redirection briefing |
| Accessibility | Dedicated `get_accessibility_services` tool, elevator-aware gate routing, WCAG-oriented UI (see §9) |
| Transportation | `get_transport_options` tool: shuttle ETA, parking occupancy, transit status, rideshare wait |
| Sustainability | `get_sustainability_tip` tool recommends transit/shuttle when parking is nearly full or transit is disrupted |
| Multilingual assistance | The Gemini-backed assistant detects and replies in the fan's own language natively — not a fixed language dropdown |
| Operational intelligence | `/ops.html` staff view: AI-generated redirection briefings from the same live venue data |
| Real-time decision support | The assistant reasons over *live* tool results every turn — it never recites static text |

### How this satisfies the brief's Challenge Expectations

The brief lists four explicit expectations, independent of the eight capability verticals above. Each has a direct, concrete answer in this codebase rather than being left implicit:

| Challenge Expectation (brief's wording) | Where and how |
|---|---|
| "Ability to build a smart, dynamic assistant" | `src/ai/geminiClient.ts` — a genuine Gemini tool-calling loop, not a scripted FAQ. The model chooses which of 7 live-data tools to call based on the fan's actual message. |
| "Logical decision making based on user context" | `src/ai/systemPrompt.ts` — explicit instructions to prefer an elevator-guaranteed gate when a mobility need is mentioned, and to proactively suggest an alternative gate when the current one is crowded. See §2. |
| "Practical and real-world usability" | Real FIFA World Cup 2026 venues (not placeholders), zero-setup fallback mode so the app is never broken for a reviewer (§2), and a punctuation-insensitive venue matcher fixed after a real bug was found by manually testing "Levis Stadium" / "ATT Stadium" (§6). |
| "Clean and maintainable code" | See §7 (Code Quality): zero `any` types, CI-enforced lint/format/typecheck/test/build on every push, Google's own published TypeScript style guide cited and applied. |

---

## 2. Approach and logic

### Why this is real GenAI, not "if/else with an AI label"

It is easy to build a stadium app that *looks* AI-driven but is really just threshold logic (`if density > 80: say "busy"`) with no model in the loop. This project deliberately avoids that: the fan-facing assistant is a genuine Gemini **tool-calling** loop (Google's Interactions API) — the model decides *which* tools to call based on what the fan actually said (their stated mobility needs, urgency, language), not a fixed script. See `src/ai/geminiClient.ts` and `src/ai/tools.ts`.

The one part of the app that *is* deterministic on purpose is the **live venue data** (`src/data/liveState.ts`): there is no public real-time feed for FIFA 2026 gate-level crowd density, so it is simulated with a seeded, bounded, pure function of `(venue, gate, minute)`. That's a modeling choice, documented in §4, not a shortcut around using GenAI.

### Graceful degradation is a first-class design goal

Given the hackathon's "maximum 1 attempt" rule, the single worst outcome is a reviewer cloning the repo, not configuring a `GEMINI_API_KEY`, and seeing a broken app. So the assistant has a fully deterministic **fallback engine** (`src/ai/fallbackEngine.ts`) that answers real questions using the same live data, with zero setup. If `GEMINI_API_KEY` is unset, or a live Gemini call fails or times out, the app transparently degrades — the UI shows an "Offline reasoning mode" badge instead of erroring. This is implemented once, centrally, in `assistantService.ts`, not duplicated per route.

### Context-aware reasoning in practice

The system prompt (`src/ai/systemPrompt.ts`) explicitly instructs the model to: prefer an elevator-guaranteed gate when a fan mentions a mobility need, proactively suggest an alternative when the fan's current gate is crowded, and reply in whatever language the fan wrote in. This is what "logical decision making based on user context" means here — not a static FAQ.

---

## 3. How the solution works

```
Fan's phone (public/index.html + app.js)
      │  fetch()
      ▼
Express API (src/app.ts)
  ├─ /api/chat    ──► assistantService.getAssistantReply()
  │                     ├─ Gemini configured? ─► geminiClient (Interactions API, tool-calling loop)
  │                     │                          └─ tools.ts ─► liveState.ts (simulated live venue data)
  │                     └─ not configured / call failed ─► fallbackEngine.ts (deterministic, same data)
  ├─ /api/venues  ──► static + live venue data (for the fan status strip)
  └─ /api/ops     ──► assistantService.getOpsInsight()  (staff/volunteer briefing, same pattern)

Staff/volunteer phone or kiosk (public/ops.html + ops.js) ── same API, different view
```

**Request flow for one chat message:** validate (`zod`) → rate-limit → build a rolling text transcript of the last 6 turns → Gemini call with the 7 read-only tools declared in `tools.ts` → Gemini decides whether to call a tool (e.g. `get_least_crowded_gate`) → the tool result (real, computed data) is sent back to Gemini → Gemini writes the final natural-language, multilingual reply → reply returned as JSON, rendered client-side via `textContent` only.

**Tech stack:** TypeScript + Express backend (typed, testable, one build step); vanilla HTML/CSS/JS frontend (no bundler, nothing to fail to build for a reviewer); Google Gemini via `@google/genai`'s Interactions API for function-calling; Jest + Supertest for testing.

---

## 4. Assumptions

- **Live venue data is simulated.** There is no public real-time FIFA 2026 gate/crowd/transport feed. `src/data/liveState.ts` derives plausible, bounded values from a seeded pseudo-random function of `(venue, gate, minute)`, so it's deterministic and testable rather than genuinely random. Venue names, cities, capacities and the 16-host-city list are real, public FIFA World Cup 2026 information.
- **Fallback mode is English-only.** The Gemini-backed assistant is fluently multilingual; the deterministic fallback (used when no API key is configured) uses keyword matching and English templates only. This is a scope trade-off, not an oversight — documented so it reads as a decision.
- **Heat/altitude advisory is a coarse heuristic** (`isHeatAdvisoryActive`) based on venue notes and time-of-day, not a live weather feed.
- **Gate layout (letters A–E/F) is illustrative**, since real per-gate identifiers for 2026 venues aren't yet public; the venues, cities and capacities themselves are factual.
- **No user accounts or persistent chat history.** Conversations are stateless by design (see §8, Security) — this was a deliberate privacy choice, not a missing feature.

---

## 5. Setup

```bash
npm install
cp .env.example .env        # optional — see below
npm run build
npm start                   # http://localhost:3000
```

- **`GEMINI_API_KEY` is optional.** Leave it blank in `.env` (or don't create `.env` at all) to run entirely in deterministic fallback mode — no billing setup required to evaluate this submission.
- With a key set, get one at <https://aistudio.google.com/apikey> and the assistant runs the full Gemini tool-calling loop instead.
- `npm run dev` runs the server with live reload (`tsx watch`).
- Open `/index.html` for the fan assistant, `/ops.html` for the staff Ops Insight view.

---

## 6. Testing

```bash
npm test              # 78 unit + integration tests
npm run test:coverage # coverage report (~92% statements)
npm run lint          # ESLint (TypeScript + the vanilla JS frontend)
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
```

All five checks above (plus the build) run automatically in GitHub Actions on every push — see `.github/workflows/ci.yml` and `CONTRIBUTING.md`.

Unit tests cover the live-data engine (determinism + bounds + cache-hit proofs), every AI tool (valid/invalid input), the fallback engine's venue/intent matching (including a regression test for a real punctuation-matching bug found by manual testing — see `tests/unit/fallbackEngine.test.ts`), the Gemini tool-calling loop (SDK mocked, no network needed), the graceful-degradation orchestration layer, and the error-handling middleware. Integration tests exercise the real Express app end-to-end with Supertest, including validation, 404s, and security headers.

---

## 7. Code Quality

This codebase was explicitly checked against Google's own published engineering standards, not just "cleaned up" by feel:

- **[Google's Engineering Practices / code review standard](https://google.github.io/eng-practices/review/reviewer/standard.html):** "could the code be made simpler," consistency with the rest of the codebase, and well-designed automated tests weigh more than personal style preference.
- **[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html):** it explicitly calls type assertions like `as SomeType` "unsafe," since they silence the compiler without a runtime check. Concretely, `src/` has **zero `any` types**. The one place an external SDK's request-side shapes aren't part of its public export surface (`@google/genai`'s `Step`/`Tool` types — verified directly against the vendored `.d.ts`, not assumed), `src/ai/geminiClient.ts` defines a precise local mirror type and isolates the one unavoidable boundary cast to a single commented line, derived from the SDK's own declared signature via TypeScript's `Parameters<>` utility rather than a hand-typed guess.
- **[gts](https://github.com/google/gts)**, "Google's TypeScript style guide, formatter, and linter," is what Google's own Node.js client libraries are formatted and linted with. This project mirrors that discipline with Prettier + ESLint enforced in CI (`.github/workflows/ci.yml`) on every push, rather than left to manual review.
- **Stricter-than-default TypeScript**: `tsconfig.json` enables `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` on top of `strict` — both flags exist specifically to catch a class of undefined-access bugs that plain `strict` mode misses, and every place they initially flagged real code was fixed properly (e.g. replacing a `sort(...)[0]` with a non-empty-safe `reduce`), not suppressed.
- **Named constants over magic strings** for the Gemini wire-format discriminators (`STEP_TYPE.FUNCTION_CALL` instead of a bare `'function_call'` repeated in several places) — a typo in a constant reference is a compile error; a typo in a repeated string literal is a silent runtime bug.
- Consistent formatting enforced by Prettier and `.editorconfig`, not left to reviewer taste.

See `CONTRIBUTING.md` for the full list of design principles this repo follows.

---

## 8. Security

See [`SECURITY.md`](./SECURITY.md) for the full write-up (OWASP Top 10 for LLM Applications mapping, prompt-injection posture, and why conversations are stateless by design). Summary: helmet with a strict `default-src 'self'` CSP, CORS allowlist, per-IP rate limiting on the AI endpoint, `zod` validation on every request body/param, a fixed read-only tool allowlist for the model (no filesystem/network/shell access), and client-side rendering exclusively via `textContent` (never `innerHTML`) to close off DOM-based XSS.

## 9. Accessibility

- Semantic landmarks, a skip link, and a `role="log"`/`aria-live="polite"` chat region so screen readers announce new replies.
- Every control is keyboard-operable with a visible `:focus-visible` ring.
- User-toggleable high-contrast and large-text modes (`accessibility-bar` in `index.html`).
- `prefers-reduced-motion` disables the message and alert animations.
- The assistant itself treats accessibility as a first-class input: a stated mobility need changes *which* gate it recommends, not just the wording of the reply.

## 10. Efficiency

- **One seeded PRNG stream per gate-per-minute, not four.** `src/data/liveState.ts` used to re-hash and re-seed a new generator for every individual field (density, wait, elevator, shuttle); it now seeds one stream per key and draws four sequential values from it — a straightforward 4x reduction in hashing work per gate snapshot, with no change to determinism or bounds (see the updated tests in `tests/unit/liveState.test.ts`).
- **A small, bounded memoization cache** (`gateSnapshotCache` / `transportSnapshotCache`, capped at 500 entries with oldest-first eviction) serves repeat reads within the same minute — e.g. the fan chat and the staff Ops Insight briefing asking about the same gate seconds apart — from cache instead of recomputing. Two tests assert this by checking for the *same object reference* on a repeat call, not just an equal value, to actually prove the cache path is exercised.
- **Gzip/brotli response compression** (`compression` middleware) on every response, API and static alike.
- **HTTP caching headers**: static JS/CSS get `Cache-Control: public, max-age=600`; the static 16-venue list (`GET /api/venues`) gets `max-age=60` since it cannot change within a process lifetime; the two HTML entry points and every live/dynamic endpoint (`/status`, `/insight`, `/chat`) are explicitly `no-cache` so nothing stale is ever served for data that's supposed to be live.
- The live-data engine is O(1) per gate lookup and O(gates) for venue-wide queries — at most 6 gates per venue.
- A 12-second timeout and a 3-round cap bound every Gemini call so a slow or looping model response can never hang a request.
- `express.json({ limit: '32kb' })` and per-endpoint rate limiting bound both memory and Gemini API cost per request.
- The frontend is framework-free static assets (no bundler, no hydration) — the entire `public/` directory is a few KB.

---

## License

MIT — see [`LICENSE`](./LICENSE).
