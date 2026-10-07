# Content Studio (frontend)

Page: `/content-studio` (gated by the `content_studio` tenant feature). Areas:
Plan, Calendar, Create, Library, Media, Downloads, Analytics. It opens on
Calendar; old `?tab=today` links land there too.

## My Tasks carries the daily to-dos

There is no Today area (removed 2026-10-06). What it showed now lives in My
Tasks (`/tasks`, `web/src/components/tasks/MyTasks.tsx`), so a client has one
list for everything that needs them:

- **Approvals**: posts awaiting approval come through `GET /api/approvals/pending`
  as `type: 'content_post'`; Approve / Send back post to
  `/api/approvals/content_post/:id/decision`.
- **Content tab**: `GET /api/content-studio/tasks` (SDK `useContentTasks`):
  posts due now (Mark as posted), posts going out today, drafts with no time,
  next week's gaps (Fill the gaps → `POST /plan/fill-gaps`) and LinkedIn to
  connect. Showcase samples never appear: they never go out.
- The sidebar's My Tasks entry and badge show for a workspace with Conversations
  **or** Content Studio (`useTaskSources`); chat sections hide without
  Conversations. "Where posts go out" moved to Plan (`ChannelsCard`).
Backend contract and runbooks: `LAD_backend/features/content-studio/README.md`.

## Platforms switched off for now (Facebook, X, TikTok)

Hidden on 2026-10-05 (LAD-Backend#977, LAD-Frontend#1247). **They are fully
built: switch them back on, don't rebuild.**

- The backend decides, via its env `CONTENT_STUDIO_PLATFORMS` (default
  `linkedin,instagram`), and returns the list as `settings.enabledPlatforms`.
- Every picker, filter and list here reads it through
  `useEnabledPlatforms()` (`sdk/features/content-studio/hooks.ts`):
  the composer's platform buttons and preview tabs, the calendar filter, the
  Library filter, Plan's posts-per-week rows, "Help me post something" and the
  repurpose copy. `DEFAULT_ENABLED_PLATFORMS` (types.ts) is only a fallback for
  a server that sends nothing.
- All the platform-specific UI is still here and untouched: `PLATFORM_META`
  (labels, colours, caption limits), the X/TikTok/Facebook previews in
  `PlatformPreview.tsx`, the X thread editor in `FormatEditors.tsx`,
  hashtag rules, formats per platform.

**To turn one back on:** follow the runbook in the backend README ("Turning a
platform back on"). No frontend change or deploy is needed. Then update the
e2e test "Only LinkedIn and Instagram are offered…" in
`web/e2e/content-studio/content-studio.spec.mjs` (it asserts the current
two-platform set) and run the suite with the mock set to the new list
(`MOCK_PLATFORMS`, see `web/e2e/content-studio/README.md`).
