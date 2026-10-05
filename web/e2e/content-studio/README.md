# Content Studio e2e

Drives the real Next.js build of `/content-studio` at 390, 768 and 1440 px against
`mock-backend.mjs`, an in-memory stand-in for LAD_backend's `/api/content-studio`
(seeded from `fixtures/content-studio-seed.json`, the same file as
`LAD_backend/features/content-studio/seed/showcase.json`). Nothing touches the
shared dev database.

What it checks: every area renders without sideways scroll, and Content Studio
opens on Calendar; every control is 44 × 44 or larger; My Tasks shows Content
Studio's approvals, posts due, gaps and accounts to connect (never showcase
samples); approve 1 tap from My Tasks, edit and reschedule 3 or fewer from
Calendar, download 2, create 3; every download is a real file (PNG signature
and 1080 × 1080 size, PDF header and page count, TXT, CSV header); versions
restore; text contrast 4.5:1 or better (3:1 for large text) in light and dark;
prefers-reduced-motion removes transitions; no label says AI, agentic, virality
or ICP; no request leaves localhost (fonts aside) and no third-party scheduler
is referenced.

## Run

```bash
# 1. mock backend (port 4799)
node e2e/content-studio/mock-backend.mjs
# 2. a production build pointed at it (port 3021)
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4799 BACKEND_INTERNAL_URL=http://127.0.0.1:4799 \
BACKEND_URL=http://127.0.0.1:4799 API_BASE_URL=http://127.0.0.1:4799 \
npx next build --webpack && npx next start -p 3021
# 3. the tests (Playwright is not a dependency of this repo; any Playwright ≥ 1.50 works)
npx playwright test --config e2e/content-studio/playwright.config.mjs
```

Results land in `e2e/content-studio/results/` (JSON, HTML report, screenshots per width).

## Platforms switched on in the mock

The mock mirrors the backend's `CONTENT_STUDIO_PLATFORMS` with `MOCK_PLATFORMS`
(default `linkedin,instagram`; Facebook, X and TikTok are hidden for now). To
run with all five, start the mock with
`MOCK_PLATFORMS=linkedin,instagram,facebook,x,tiktok node e2e/content-studio/mock-backend.mjs`
and update the "Only LinkedIn and Instagram are offered…" test, which asserts
the two-platform set.

