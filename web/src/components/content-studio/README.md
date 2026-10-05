# Content Studio (frontend)

Page: `/content-studio` (gated by the `content_studio` tenant feature). Areas:
Today, Plan, Calendar, Create, Library, Media, Downloads, Analytics.
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
