# Contributing

This started as a hackathon submission, but is written to be maintained past submission day.

## Local development

```bash
npm install
npm run dev          # tsx watch, live-reloads src/server.ts
```

## Before opening a pull request

```bash
npm run lint          # ESLint (TypeScript + the vanilla JS frontend)
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
npm test              # Jest: unit + integration
npm run build         # tsc -p tsconfig.json
```

All five run automatically in CI (`.github/workflows/ci.yml`) on every push and pull request against `main`; a change that fails any of them won't go green.

## Code style

This project follows the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) where practical for an Express/Node codebase of this size — notably: avoid `any`/unsafe assertions in favor of precise local types with a single justified, commented boundary cast where an external SDK's types aren't public; document all top-level exports; prefer simplicity a reviewer can hold in their head over cleverness. Formatting is enforced by Prettier (`.prettierrc.json`) rather than debated in review.

## Design principles specific to this repo

- **Graceful degradation is not optional.** Every AI-backed code path (`src/ai/assistantService.ts`) must have a deterministic fallback and must never throw an unhandled error back to an HTTP caller.
- **The model's capability surface is the tool allowlist, full stop.** New tools go through `src/ai/tools.ts` with `zod` validation; no tool may reach the filesystem, network, or a shell. See `SECURITY.md`.
- **Live venue data is simulated on purpose** (`src/data/liveState.ts`) — keep it a pure, seeded function of `(id, minute)` so it stays deterministic and testable if you extend it.
