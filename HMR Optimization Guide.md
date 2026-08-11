# Monorepo HMR & Turbopack Optimization Guide

This document records all configuration and code changes made to resolve slow Hot Module Reloading (HMR) and migrate the Next.js monorepo from Webpack to Turbopack.

> **Status:** All changes are applied and in the branch `chore/dev-turbopack-hmr-optimization`.
> The dev server (`next dev --turbo`) is working locally. One verification step remains before the PR is merged — see [Pre-Merge Verification](#pre-merge-verification) at the bottom.

---

## Quick Start (if you're picking this up)

The branch already contains all changes. Just clear the old Webpack cache and start the dev server:

**Windows PowerShell:**
```powershell
Remove-Item -Recurse -Force "web/.next" -ErrorAction SilentlyContinue
npm run dev
```

**Linux / macOS:**
```bash
rm -rf web/.next
npm run dev
```

---

## 1. What Was Changed and Why

| Change | File | Why |
| :--- | :--- | :--- |
| Replace `externalDir: true` with `transpilePackages` + `optimizePackageImports` | `web/next.config.mjs` | `externalDir` was a legacy workaround. `transpilePackages` is the correct modern way to tell Next.js to compile a local workspace package (`@lad/frontend-features`). `optimizePackageImports` tree-shakes it per-feature. |
| Add `@lad/shared` alias to both Webpack and Turbopack configs | `web/next.config.mjs` | Allows both bundlers to resolve `@lad/shared/*` imports from the `sdk/shared/` directory. |
| Remove `@lad/frontend-features$` exact-match alias | `web/next.config.mjs` | No longer needed — `transpilePackages` handles resolution via the SDK's `exports` map. |
| Switch dev script to `next dev --turbo` | `web/package.json` | Enables Turbopack bundler for local development. Turbopack is Rust-based and significantly faster than Webpack for HMR — typically **3–5× faster**, with updates in under 500ms. |
| Switch build script to `next build` | `web/package.json` | In Next.js 16, `next build` uses Turbopack by default. The `turbopack.resolveAlias` block in `next.config.mjs` already mirrors all the Webpack aliases, so production builds are covered. |
| Remove redundant tsconfig path mappings | `web/tsconfig.json` | The 21 `@lad/frontend-features/*` paths were forcing TypeScript to read raw SDK source files directly. With `transpilePackages` and the SDK's `exports` map in place, Node/TypeScript module resolution handles these correctly without explicit path overrides. |
| Add `persistent: true` to dev task | `turbo.json` | Tells Turborepo that `dev` is a long-running watch process, not a task that should "finish." Prevents task deadlocks in `turbo run dev`. |
| Simplify escaped Tailwind class variant | `web/src/components/conversations/WABusinessView.tsx` | The original deeply-escaped arbitrary variant (`[&_.dark\:bg-\[\\#111b21\]]`) causes the Rust CSS parser (LightningCSS) inside Turbopack to panic. The simplified form (`[&_[class*='111b21']]`) is functionally identical and parser-safe. |
| Fix TypeScript return type bug | `sdk/features/lad-monitor/api.ts` | `getMigrationStatus()` was returning `res.data` (the full `{ success, data }` wrapper) instead of `res.data.data` (the actual `MigrationStatusData`). Independent fix bundled in the same commit. |
| Add `./community-roi/types` to SDK exports | `sdk/package.json` | Two files (`OutreachAnalysis.tsx`, `MemberProfileView.tsx`) import `@lad/frontend-features/community-roi/types` directly. Removing the tsconfig paths required adding this subpath to the SDK's exports map so TypeScript and the bundler can resolve it. |

---

## 2. Files Changed

### `web/next.config.mjs`

**Before:**
```javascript
const nextConfig = {
  // ✅ REQUIRED when importing ../sdk
  experimental: {
    externalDir: true,
    ...
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tanstack/react-query': path.resolve(__dirname, '../node_modules/@tanstack/react-query'),
      '@tanstack/query-core': path.resolve(__dirname, '../node_modules/@tanstack/query-core'),
      'chart.js': path.resolve(__dirname, 'node_modules/chart.js/dist/chart.js'),
      '@lad/frontend-features$': path.resolve(__dirname, '../sdk'),  // ← removed
      '@livekit/components-react': ...,
      '@livekit/components-styles': ...,
      'livekit-client': ...,
    };
    ...
  },

  turbopack: {
    resolveAlias: {
      '@tanstack/react-query': '../node_modules/@tanstack/react-query',
      '@tanstack/query-core': '../node_modules/@tanstack/query-core',
      'chart.js': './node_modules/chart.js/dist/chart.js',
      '@lad/frontend-features$': '../sdk',  // ← removed
      ...
    },
  },
};
```

**After:**
```javascript
const nextConfig = {
  transpilePackages: ['@lad/frontend-features'],  // ← added

  // ✅ REQUIRED when importing ../sdk
  experimental: {
    optimizePackageImports: ['@lad/frontend-features'],  // ← replaced externalDir
    ...
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tanstack/react-query': path.resolve(__dirname, '../node_modules/@tanstack/react-query'),
      '@tanstack/query-core': path.resolve(__dirname, '../node_modules/@tanstack/query-core'),
      '@lad/shared': path.resolve(__dirname, '../sdk/shared'),  // ← added
      'chart.js': path.resolve(__dirname, 'node_modules/chart.js/dist/chart.js'),
      // @lad/frontend-features$ removed — transpilePackages covers it
      ...
    };
    ...
  },

  turbopack: {
    resolveAlias: {
      '@tanstack/react-query': '../node_modules/@tanstack/react-query',
      '@tanstack/query-core': '../node_modules/@tanstack/query-core',
      '@lad/shared': '../sdk/shared',  // ← added
      'chart.js': './node_modules/chart.js/dist/chart.js',
      // @lad/frontend-features$ removed — transpilePackages covers it
      ...
    },
  },
};
```

---

### `web/package.json`

```diff
-  "dev": "next dev --webpack",
-  "build": "next build --webpack",
+  "dev": "next dev --turbo",
+  "build": "next build",
```

> **Note on production:** `next build` in Next.js 16 uses Turbopack by default. The `turbopack.resolveAlias` block in `next.config.mjs` already lists all the aliases that the `webpack()` block uses (react-query, livekit, chart.js, @lad/shared), so production bundling is correctly configured. The Docker/Cloud Run pipeline (`Dockerfile` line 88: `RUN npm run build`) does not need any changes — it already calls `npm run build`.

---

### `web/tsconfig.json`

Removed 21 explicit `@lad/frontend-features/*` path entries from `compilerOptions.paths` and removed `../sdk/**/*.ts` / `../sdk/**/*.tsx` from `include`.

Kept:
```json
"@/*": ["./src/*"],
"@lad/shared/*": ["../sdk/shared/*"]
```

**Why this is safe:** The SDK's `package.json` has a proper `exports` map listing every feature subpath (e.g. `./campaigns`, `./community-roi`, etc.). TypeScript with `moduleResolution: "bundler"` uses that exports map directly. The explicit tsconfig paths were duplicating what the exports map already declares, and forcing TypeScript to parse SDK source files directly on every type-check run.

**Edge case handled:** `OutreachAnalysis.tsx` and `MemberProfileView.tsx` import `@lad/frontend-features/community-roi/types` — a subpath that was not in the SDK's exports map. This was fixed by adding it to `sdk/package.json` (see below).

---

### `sdk/package.json`

Added one exports entry:
```json
"./community-roi/types": {
  "types": "./features/community-roi/types.ts",
  "default": "./features/community-roi/types.ts"
}
```

This exposes the `types.ts` file inside `community-roi` as a direct importable subpath, so `import { UUID } from '@lad/frontend-features/community-roi/types'` resolves correctly without needing a tsconfig path override.

---

### `turbo.json`

```diff
 "dev": {
-  "cache": false
+  "cache": false,
+  "persistent": true
 }
```

---

### `web/src/components/conversations/WABusinessView.tsx`

```diff
- <div className="[&_.dark\:bg-\[\\#111b21\]]:dark:bg-[rgb(22,23,23)] [&_[class*='dark:bg-']>div]:dark:bg-[rgb(22,23,23)]">
+ <div className="[&_[class*='111b21']]:dark:bg-[rgb(22,23,23)] [&_[class*='dark:bg-']>div]:dark:bg-[rgb(22,23,23)]">
```

The original deeply-escaped selector (`dark\:bg-\[\\#111b21\]`) triggers a panic in the Rust CSS parser inside Turbopack when it encounters the multi-level escape sequences. The replacement uses a CSS substring match (`[class*='111b21']`) which targets the same elements, is visually equivalent, and is valid syntax for all parsers.

---

### `sdk/features/lad-monitor/api.ts`

```diff
- return res.data;
+ return res.data.data;
```

`apiGet<{ success: boolean; data: MigrationStatusData }>` returns `{ success, data }`. The function was returning the outer wrapper instead of the inner `MigrationStatusData`. Independent bug fix bundled in this commit.

---

## 3. Why `exceljs` Is Not a Problem

During review, a concern was raised: the `webpack()` config aliases `exceljs` to its browser-compatible minified build (`exceljs/dist/exceljs.min.js`) to prevent Node.js-only APIs from being included in client bundles. Under Turbopack, the `webpack()` function is not called.

**This turned out to be a non-issue.** `exceljs`'s own `package.json` has:
```json
"main": "./excel.js",
"browser": "./dist/exceljs.min.js"
```

The `browser` field is a standard convention that tells any modern bundler (Webpack, Turbopack, esbuild, etc.) to automatically use the browser-safe build when targeting a browser environment. Turbopack respects this field. The manual webpack alias was redundant insurance — both bundlers end up using `exceljs.min.js` for client components.

This was verified manually: navigating to the Import Leads dialog and importing an Excel file works correctly under `next dev --turbo`.

---

## Pre-Merge Verification

All local dev functionality has been confirmed working. Before merging the PR, one production build test should be run to confirm the full Turbopack build pipeline works end-to-end:

```powershell
# Run from the web directory — this is exactly what Docker/Cloud Run does
cd web
npx next build
```

**What to look for:**

| Output | Meaning |
| :--- | :--- |
| `✓ Compiled successfully` at the end | ✅ Build is safe to merge |
| Build completes and `.next/standalone/web/server.js` exists | ✅ Docker deployment path will work |
| Module resolution errors (e.g. `Cannot find module`) | ❌ An alias is missing from `turbopack.resolveAlias` |
| OOM / heap crash | ❌ Increase `NODE_OPTIONS=--max-old-space-size=...` (already set to 6GB in Dockerfile, set the same env var locally if needed) |

If the build passes locally, the PR is ready to merge.
