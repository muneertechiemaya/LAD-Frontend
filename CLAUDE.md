# LAD-Frontend

npm workspaces monorepo. `web/` is the Next.js app; `sdk/` holds the feature clients.
The only lockfile is at the repo root — `npm ci` runs there, not in `web/`.

## What CI will do to your PR

`.github/workflows/` — on PRs to `develop`, `stage`, `main`:

- **ci.yml → lint: HARD GATE.** `npm run lint` in `web/`. No `continue-on-error` —
  an ESLint **error** blocks the merge. Warnings do not (the tree carries thousands).
- **ci.yml → type-check: REPORT-ONLY.** `tsc --noEmit` against a baseline of **363**
  known errors. It never fails the build; it annotates the PR when you go above the
  baseline. It exists because `next build` does *not* type-check
  (`typescript.ignoreBuildErrors: true` in `next.config.mjs`), and missing-export bugs
  twice reached users as runtime crashes. Treat "more errors than baseline" as a real
  finding — it usually means a bad import.
- **security.yml → gitleaks: HARD GATE on PRs.**
- **guardrails.yml: warn only.** New `lad_dev.` literals (M3), new `organization_id` (M2).

Burn the type baseline down when you can, and lower `BASELINE` in `ci.yml` to lock the
win in.

## Running the gates locally

```bash
cd web && npx eslint src/path/to/changed-file.tsx
cd web && npx tsc --noEmit
```

Lint the files you changed rather than the whole tree — ESLint errors are per-file, so
a changed-file run tells you what CI's full run will say, in seconds.

**If `tsc` finishes in a few seconds and reports `TS2688: Cannot find type definition
file for '@types'`, it did not type-check anything.** Something has put a
self-referential symlink at `node_modules/@types/@types`. Remove that symlink and
re-run; a "0 errors" result from a tsc that aborted is not a pass.

## Layering

`sdk/features/<feature>/` holds `api.ts` (HTTP only), `types.ts`, `hooks.ts`, `index.ts`.
`web/` is supposed to render UI and call SDK hooks, not `fetch()` directly.

Note the gap between that rule and the tree: several large screens — notably
`web/src/app/onboarding/advanced-search-ai/page.tsx` — call `fetch('/api/…')` inline.
New code should go through the SDK. If you must add an inline `fetch` next to existing
ones, match the surrounding file and say so, rather than pretending it's the standard.

Requests from `web/` to `/api/*` reach the backend through the catch-all proxy at
`web/src/app/api/[feature]/[...path]`, so a new backend route under an existing feature
needs no frontend plumbing.
