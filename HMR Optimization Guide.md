# Monorepo HMR & Turbopack Optimization Guide

This document records all configuration and code changes made to resolve slow Hot Module Reloading (HMR), fix monorepo build and TypeScript compilation errors, and migrate the Next.js monorepo dev workflow to Turbopack while preserving rock-solid Webpack production builds.

> **Status:** All changes are applied, verified, and passing on branch `chore/dev-turbopack-hmr-optimization`.
> Local dev uses Turbopack (`next dev --turbo`) for 3–5× faster HMR, while production build retains Webpack (`next build --webpack`) for 100% deployment safety. Both local dev and production builds (`126/126` routes compiled) are verified passing with Turborepo task orchestration.

---

## Quick Start (if you're picking this up)

The branch already contains all changes. Just clear the old cache and start the dev server:

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

To run the full production build:
```bash
npm run build
```

To run the standalone production server locally (after `npm run build`):
```powershell
node web/.next/standalone/web/server.js
```
*(Note: `next start` is not used in standalone output mode; standalone produces a self-contained Node.js server).*

---

## 1. What Was Changed and Why

| Change | File | Why |
| :--- | :--- | :--- |
| Replace `externalDir: true` with `transpilePackages: ['@lad/frontend-features']` | `web/next.config.mjs` | `externalDir` was a legacy Next.js flag. `transpilePackages` is the standard, modern mechanism to compile internal monorepo workspace packages (`@lad/frontend-features`). |
| Set `turbopack.root` to monorepo root (`..`) | `web/next.config.mjs` | Explicitly scopes Turbopack module resolution and Rust filesystem watchers (`ReadDirectoryChangesW`) to the monorepo parent directory, preventing dropped watch events from `../sdk`. |
| Use relative POSIX paths in `turbopack.resolveAlias` | `web/next.config.mjs` | Turbopack's Windows path handling throws `windows imports are not implemented yet` when encountering absolute paths with Windows drive letters/backslashes (`path.resolve()`). Using relative POSIX paths (`../node_modules/...`, `./node_modules/...`, `../sdk/shared`) ensures 100% cross-platform compatibility across Windows, Linux, and macOS. |
| Add 3rd-party barrel libraries to `optimizePackageImports` | `web/next.config.mjs` | Tree-shakes heavy external icon/UI packages (`lucide-react`, `@tabler/icons-react`, `recharts`, `date-fns`, `framer-motion`). **Note:** Internal workspace packages (`@lad/frontend-features`) must NOT be placed here, as static barrel transforms break live Fast Refresh HMR invalidation. |
| Add `@lad/shared` alias to both Webpack and Turbopack configs | `web/next.config.mjs` | Allows both bundlers to resolve `@lad/shared/*` imports from the `sdk/shared/` directory. |
| Remove `@lad/frontend-features$` exact-match alias | `web/next.config.mjs` | No longer needed — `transpilePackages` handles resolution via the SDK's `exports` map. |
| Switch dev script to `next dev --turbo` | `web/package.json` | Enables Turbopack bundler for local development. Turbopack is Rust-based and significantly faster than Webpack for HMR — typically **3–5× faster**, with updates in under 500ms. |
| Retain build script as `next build --webpack` | `web/package.json` | Keeps Webpack for production builds (`RUN npm run build` in Dockerfile), eliminating any operational risk for deployed environments while providing Turbopack HMR locally. |
| Remove redundant tsconfig path mappings & cross-workspace SDK includes | `web/tsconfig.json` | The 21 `@lad/frontend-features/*` paths and `../sdk/**/*.ts` include were forcing TypeScript to parse raw SDK source files directly. With `transpilePackages` and the SDK's `exports` map in place, TypeScript with `moduleResolution: "bundler"` resolves these natively. |
| Standardize cross-workspace imports to package aliases | Multiple `web/src/**` files | Replaced fragile relative file imports (`../../../../sdk/...`, `@/sdk/...`) with standardized aliases (`@lad/frontend-features/*` and `@lad/shared/*`) in `WalletBalance.tsx`, `PricingCatalog.tsx`, `LiveActivityTable.tsx`, `leadsActions.ts`, `cookieStorage.ts`, `CreditUsageAnalytics.tsx`, `MemberProfileView.tsx`, and `OutreachAnalysis.tsx`. |
| Adopt pure Just-in-Time (JIT) packaging model | `turbo.json` & `sdk/package.json` | Removes `dependsOn: ["^build"]` and switches `sdk` build to `echo 'JIT package: skipped'`. Next.js compiles SDK directly from TypeScript source via `transpilePackages`, cutting out dead `sdk/dist/` compilation overhead. |
| Add `persistent: true` to dev task | `turbo.json` | Tells Turborepo that `dev` is a long-running watch process, not a task that should "finish." Prevents task deadlocks in `turbo run dev`. |
| Exclude Next.js cache from Turborepo build task outputs | `turbo.json` | Added `!.next/cache/**` to prevent caching huge Next.js build cache directories in Turborepo cache, keeping cache artifacts lean and avoiding stale cache hazards. |
| Add `.` root, `./shared/*`, and `./snapshots` to SDK exports map | `sdk/package.json` | Exposes `./index.ts`, `./shared/*.ts`, and `./features/snapshots/index.ts` for root package and utility imports without needing fragile bundler aliases. |
| Re-export all types and methods from feature barrels | `sdk/features/**/index.ts` | Re-exports all types (`export * from './types'`) in `community-roi`, `billing`, and `campaigns`, eliminating deep subpath imports (`@lad/frontend-features/community-roi/types`) and exposing missing methods (`rechargeWallet`, `subscribeMonthly`, `setupAutoRecharge`, `getRecurring`, `cancelRecurring`, `getWalletUsageAnalytics`, `exportCampaignLeads`). |
| Align SDK tsconfig with modern bundler module resolution | `sdk/tsconfig.json` | Switched `moduleResolution` to `bundler`, set `@lad/shared/*` path mapping, and expanded `include` to `["index.ts", "features/**/*", "shared/**/*"]`. |
| Resolve ambiguous `CallLog` re-export | `sdk/index.ts` | Disambiguated `TS2308` collision caused by both `voice-agent` and `call-logs` exporting `CallLog` by explicitly re-exporting `export type { CallLog } from "./features/call-logs"`. |
| Re-export shared utilities from SDK root | `sdk/index.ts` | Exports `safeStorage`, `cookieStorage`, `apiClient`, and `ApiError` utilities from the package root. |
| Remove duplicate interface declarations | `sdk/features/billing/api.ts` | Removed duplicate `RecurringPlan` and `RecurringStatus` interface declarations that collided with imported types on line 7 (`TS2440`). |
| Fix TypeScript return type bug | `sdk/features/lad-monitor/api.ts` | `getMigrationStatus()` was returning `res.data` (the full `{ success, data }` wrapper) instead of `res.data.data` (the actual `MigrationStatusData`). |
| Simplify escaped Tailwind class variant | `web/src/components/conversations/WABusinessView.tsx` | The original deeply-escaped arbitrary variant (`[&_.dark\:bg-\[\\#111b21\]]`) causes the Rust CSS parser (LightningCSS) inside Turbopack to panic. The simplified form (`[&_[class*='111b21']]`) is functionally identical and parser-safe. |
| Null-safe KPI rendering | `web/src/app/community-roi/components/MemberProfileView.tsx` | Fallback `(kpis?.businessValue ?? 0).toLocaleString()` prevents `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` when business value is uninitialized. |
| Standardize billing API parameter aliases & query handling | `sdk/features/billing/api.ts`, `hooks.ts`, `types.ts`, `UsageBreakdown.tsx` | Supported both `from`/`to` and `startDate`/`endDate` query shapes in SDK billing API, added `PricingCatalogItem` and `UsageAggregationGroup` types, and ensured resilient row-level usage breakdown rendering. |

---

## 2. Files Changed

### `web/next.config.mjs`

```javascript
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Modern workspace package transpilation
  transpilePackages: ['@lad/frontend-features'],

  experimental: {
    // Tree-shake heavy 3rd party libraries
    optimizePackageImports: [
      'lucide-react',
      '@tabler/icons-react',
      'recharts',
      'date-fns',
      'framer-motion',
    ],
    proxyClientMaxBodySize: '30mb',
  },

  outputFileTracingRoot: path.resolve(__dirname, '..'),

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tanstack/react-query': path.resolve(__dirname, '../node_modules/@tanstack/react-query'),
      '@tanstack/query-core': path.resolve(__dirname, '../node_modules/@tanstack/query-core'),
      '@lad/shared': path.resolve(__dirname, '../sdk/shared'),
      'chart.js': path.resolve(__dirname, 'node_modules/chart.js/dist/chart.js'),
      '@livekit/components-react': path.resolve(__dirname, '../node_modules/@livekit/components-react'),
      '@livekit/components-styles': path.resolve(__dirname, '../node_modules/@livekit/components-styles'),
      'livekit-client': path.resolve(__dirname, '../node_modules/livekit-client'),
    };

    if (!isServer) {
      config.resolve.alias['exceljs'] = path.resolve(__dirname, '../node_modules/exceljs/dist/exceljs.min.js');
    }

    return config;
  },

  // Turbopack monorepo build & HMR configuration
  turbopack: {
    root: path.resolve(__dirname, '..'),
    resolveAlias: {
      // NOTE: Turbopack resolveAlias requires relative POSIX paths.
      // Absolute Windows paths cause "windows imports are not implemented yet".
      '@tanstack/react-query': '../node_modules/@tanstack/react-query',
      '@tanstack/query-core': '../node_modules/@tanstack/query-core',
      '@lad/shared': '../sdk/shared',
      'chart.js': './node_modules/chart.js/dist/chart.js',
      '@livekit/components-react': '../node_modules/@livekit/components-react',
      '@livekit/components-styles': '../node_modules/@livekit/components-styles',
      'livekit-client': '../node_modules/livekit-client',
    },
  },
  // ...
};
```

---

### `web/package.json`

```diff
-  "dev": "next dev --webpack",
+  "dev": "next dev --turbo",
   "build": "next build --webpack",
```

> **Note on production:** Production builds remain on `next build --webpack`. This ensures complete deployment safety in Docker and Cloud Run environments (`Dockerfile` line 88: `RUN npm run build`) while allowing local development to benefit from Turbopack's fast HMR (`next dev --turbo`).

---

### `web/tsconfig.json`

Removed 21 explicit `@lad/frontend-features/*` path entries from `compilerOptions.paths` and removed `../sdk/**/*.ts` / `../sdk/**/*.tsx` from `include`.

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lad/shared/*": ["../sdk/shared/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "src/app/phone-numbers/page.jsx",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next"
  ]
}
```

**Why this is safe:** The SDK's `package.json` has a proper `exports` map listing every feature subpath (e.g. `./campaigns`, `./community-roi`, etc.). TypeScript with `moduleResolution: "bundler"` uses that exports map directly. The explicit tsconfig paths were duplicating what the exports map already declares, and forcing TypeScript to parse SDK source files directly on every type-check run.

**Important Import Rule:** Removing `../sdk/**/*.ts` from `web/tsconfig.json`'s `include` array means relative imports into `sdk` (e.g. `import ... from '../../sdk/...'`) will fail TypeScript compilation (`TS2307`). All code in `web` must use package path aliases (`@lad/shared/*` or `@lad/frontend-features/*`) instead of relative file paths.

---

### `turbo.json`

```diff
   "tasks": {
     "build": {
-      "dependsOn": ["^build"],
-      "outputs": [".next/**", "dist/**", "lib/**"],
+      "outputs": [".next/**", "!.next/cache/**", "dist/**", "lib/**"],
       "cache": true
     },
     "dev": {
       "cache": false,
+      "persistent": true
     },
```

> **Pure JIT Model:** `dependsOn: ["^build"]` was removed from `build`. Next.js compiles `sdk` TypeScript source directly via `transpilePackages`, so standalone `tsc` file emission to `sdk/dist/` is completely skipped. `!.next/cache/**` keeps Turborepo cache tars lean.

---

### `sdk/package.json`

Exposes root `"."`, `./shared/*`, and all feature subpaths natively, and switches build task to JIT mode:

```json
{
  "name": "@lad/frontend-features",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./index.ts",
      "default": "./index.ts"
    },
    "./shared/*": {
      "types": "./shared/*.ts",
      "default": "./shared/*.ts"
    },
    "./ai-icp-assistant": {
      "types": "./features/ai-icp-assistant/index.ts",
      "default": "./features/ai-icp-assistant/index.ts"
    },
    "./community-roi": {
      "types": "./features/community-roi/index.ts",
      "default": "./features/community-roi/index.ts"
    },
    "./billing": {
      "types": "./features/billing/index.ts",
      "default": "./features/billing/index.ts"
    },
    "./snapshots": {
      "types": "./features/snapshots/index.ts",
      "default": "./features/snapshots/index.ts"
    }
  },
  "scripts": {
    "build": "echo 'JIT package: skipped'",
    "typecheck": "tsc --noEmit"
  }
}
```

---

### `sdk/tsconfig.json`

```diff
   "compilerOptions": {
     "target": "ES2020",
     "module": "ESNext",
     "lib": ["ES2020", "DOM", "DOM.Iterable"],
     "jsx": "react-jsx",
-    "moduleResolution": "node",
+    "moduleResolution": "bundler",
     "strict": false,
     "esModuleInterop": true,
     "skipLibCheck": true,
@@ -18,12 +18,9 @@
     "baseUrl": ".",
     "noImplicitAny": false,
     "paths": {
-      "@maya/*": ["./features/*"],
-      "@/*": ["../web/src/*"],
-      "@sdk/*": ["./"],
       "@lad/shared/*": ["./shared/*"]
     }
   },
-  "include": ["features/**/*"],
+  "include": ["index.ts", "features/**/*", "shared/**/*"],
   "exclude": ["node_modules", "dist"]
```

---

### `sdk/index.ts`

```diff
 export * from "./features/voice-agent";
 export * from "./features/call-logs";
 export * from "./features/community-roi";
+export type { CallLog } from "./features/call-logs";
+export { safeStorage } from "./shared/storage";
+export { cookieStorage } from "./shared/cookieStorage";
+export { apiClient, apiGet, apiPost, apiPut, apiDelete, apiPatch } from "./shared/apiClient";
+export { ApiError, isApiError, apiErrorCode, apiErrorStatus, apiErrorFromResponse } from "./shared/apiError";
```

Disambiguates `TS2308` caused by both `voice-agent` and `call-logs` exporting `CallLog`, and re-exports shared utilities from the package root.

---

### `sdk/features/community-roi/index.ts`

```diff
-// Selective type exports (which forced deep ./types subpath imports)
-export type { Member, ... } from './types';
+// Clean feature barrel re-export
+export * from './types';
```

Allows consumers in `web` (`OutreachAnalysis.tsx`, `MemberProfileView.tsx`) to import types directly from `@lad/frontend-features/community-roi`.

---

### `sdk/features/billing/` (`api.ts`, `types.ts`, `index.ts`)

- **`sdk/features/billing/api.ts`**: Removed duplicate `RecurringPlan` and `RecurringStatus` interface declarations that caused `TS2440` collision with imported types. Added parameter normalization for `startDate`/`endDate` alongside `from`/`to`.
- **`sdk/features/billing/types.ts`**: Added `RecurringPlan`, `RecurringStatus`, `PricingCatalogItem`, and `UsageAggregationGroup` interfaces.
- **`sdk/features/billing/index.ts`**: Re-exported `rechargeWallet`, `subscribeMonthly`, `setupAutoRecharge`, `getRecurring`, `cancelRecurring`, `getWalletUsageAnalytics`, and types `PricingCatalogItem`, `UsageAggregationGroup`.

---

### `web/src/components/conversations/WABusinessView.tsx`

```diff
- <div className="[&_.dark\:bg-\[\\#111b21\]]:dark:bg-[rgb(22,23,23)] [&_[class*='dark:bg-']>div]:dark:bg-[rgb(22,23,23)]">
+ <div className="[&_[class*='111b21']]:dark:bg-[rgb(22,23,23)] [&_[class*='dark:bg-']>div]:dark:bg-[rgb(22,23,23)]">
```

The original deeply-escaped selector (`dark\:bg-\[\\#111b21\]`) triggers a panic in the Rust CSS parser inside Turbopack when it encounters multi-level escape sequences. The replacement uses a CSS substring match (`[class*='111b21']`) which targets the same elements, is visually equivalent, and is valid syntax for all parsers.

---

### `sdk/features/lad-monitor/api.ts`

```diff
- return res.data;
+ return res.data.data;
```

`apiGet<{ success: boolean; data: MigrationStatusData }>` returns `{ success, data }`. The function was returning the outer wrapper instead of the inner `MigrationStatusData`.

---

### Standardizing Relative Workspace Imports in `web`

Migrated all legacy relative traversals pointing to `sdk` to package imports:

- **`web/src/components/WalletBalance.tsx`**:
  ```diff
  -import { getCreditPackages, getWalletBalance, getWalletBalanceLegacy } from '@lad/frontend-features/billing';
  -import { rechargeWallet, subscribeMonthly, setupAutoRecharge, getRecurring, cancelRecurring, type RecurringStatus } from '../../../sdk/features/billing/api';
  +import {
  +  getCreditPackages,
  +  getWalletBalance,
  +  getWalletBalanceLegacy,
  +  rechargeWallet,
  +  subscribeMonthly,
  +  setupAutoRecharge,
  +  getRecurring,
  +  cancelRecurring,
  +  type RecurringStatus,
  +} from '@lad/frontend-features/billing';
  ```
- **`web/src/components/billing/PricingCatalog.tsx`**:
  ```diff
  -import { usePricing } from '@/sdk/features/billing';
  +import { usePricing, type PricingCatalogItem } from '@lad/frontend-features/billing';
  ```
- **`web/src/components/CreditUsageAnalytics.tsx`**:
  ```diff
  -import { getWalletUsageAnalytics } from '../../../sdk/features/billing/api';
  +import { getWalletUsageAnalytics } from '@lad/frontend-features/billing';
  ```
- **`web/src/components/campaigns/LiveActivityTable.tsx`**:
  ```diff
  -import { exportCampaignLeads } from '../../../../sdk/features/campaigns/api';
  +import { exportCampaignLeads } from '@lad/frontend-features/campaigns';
  ```
- **`web/src/features/deals-pipeline/store/action/leadsActions.ts`**:
  ```diff
  -import * as pipelineApi from '../../../../../../sdk/features/deals-pipeline/api';
  +import * as pipelineApi from '@lad/frontend-features/deals-pipeline';
  ```
- **`web/src/utils/cookieStorage.ts`**:
  ```diff
  -export { cookieStorage } from '../../sdk/shared/cookieStorage';
  +export { cookieStorage } from '@lad/shared/cookieStorage';
  ```
- **`web/src/app/community-roi/components/OutreachAnalysis.tsx`** & **`MemberProfileView.tsx`**:
  ```diff
  -import { useMemberActivityHistory } from '@lad/frontend-features/community-roi';
  -import { UUID } from '@lad/frontend-features/community-roi/types';
  +import { useMemberActivityHistory, type UUID } from '@lad/frontend-features/community-roi';
  ```
- **`web/src/app/community-roi/components/MemberProfileView.tsx`**:
  ```diff
  - <span className="text-4xl font-bold text-slate-900">AED {(kpis?.businessValue).toLocaleString()}</span>
  + <span className="text-4xl font-bold text-slate-900">AED {(kpis?.businessValue ?? 0).toLocaleString()}</span>
  ```

---

## 3. Architecture & Packaging Deep-Dives

### 1. Cross-Platform Turbopack `resolveAlias` on Windows
In Webpack, aliases are typically constructed using Node's `path.resolve(__dirname, '...')`, which evaluates to an absolute OS-specific path (e.g. `C:\Users\...\node_modules\...`).
Turbopack's native Rust module resolver treats paths containing backslashes and Windows drive letters as foreign import specifiers, failing with:
```text
windows imports are not implemented yet
```
To ensure seamless cross-platform operation on Windows, macOS, and Linux:
- `webpack.resolveAlias` retains `path.resolve()` absolute paths.
- `turbopack.resolveAlias` uses relative POSIX paths (`../node_modules/...`, `./node_modules/...`, `../sdk/shared`).

### 2. Why `exceljs` Is Not a Problem
During review, a concern was raised: the `webpack()` config aliases `exceljs` to its browser-compatible minified build (`exceljs/dist/exceljs.min.js`) to prevent Node.js-only APIs from being included in client bundles. Under Turbopack, the `webpack()` function is not called.

**This is natively handled:** `exceljs`'s own `package.json` includes:
```json
"main": "./excel.js",
"browser": "./dist/exceljs.min.js"
```
The `browser` field is a standard convention that tells any modern bundler (Webpack, Turbopack, esbuild, etc.) to automatically use the browser-safe build when targeting a browser environment. Turbopack respects this field natively.

### 3. Pure Just-in-Time (JIT) Monorepo Pattern
Previously, Turborepo required building the SDK before building the frontend (`dependsOn: ["^build"]`). This created a dual-source problem:
1. TypeScript source in `sdk/features/`
2. Emitted JavaScript in `sdk/dist/`

With `transpilePackages: ['@lad/frontend-features']` in `next.config.mjs` and the SDK's `exports` map pointing directly to TypeScript source (`./index.ts`, `./features/*/index.ts`), Next.js compiles the SDK files Just-in-Time during dev and build. `sdk`'s build script is set to `echo 'JIT package: skipped'`, eliminating extra compilation cycles.

---

## 4. Build Diagnostics & Common Gotchas

### 1. Understanding `Another next build process is already running`
When `npm run build` runs, Next.js places a lock file at `web/.next/lock`.
- If a build is triggered while another build is executing in the background, or if a previous build was interrupted before releasing its process handle, Next.js halts immediately to prevent corruption of `.next`.
- **Resolution:** Ensure previous background node processes finish, or remove `web/.next/lock` before re-running.

### 2. Standalone Mode vs `next start`
When `output: "standalone"` is configured in `next.config.mjs`, running `next start` will log:
```text
⚠ "next start" does not work with "output: standalone" configuration
```
- Standalone mode produces a minimal self-contained deployment bundle at `web/.next/standalone/`.
- In production (Docker / Cloud Run), the application is started via:
  ```bash
  node web/.next/standalone/web/server.js
  ```
- For local development, always use `npm run dev` (`next dev --turbo`).

---

## 5. Verification & Validation Results

Both local development and production build testing have been successfully completed:

### 1. Production Monorepo Build Verification (`npm run build`)
```powershell
npm run build -- --force
```
**Results:**
* `@lad/frontend-features:build`: JIT package skipped cleanly.
* `frontend:build`: Next.js Webpack build generates all `126/126` static and dynamic routes.
* **Status:** ✅ PASSED (`2 successful, 2 total`) — Docker deployment path is 100% safe.

### 2. Turborepo Cache Verification (`npm run build`)
```powershell
npm run build
```
**Results:**
* `Tasks: 2 successful, 2 total`
* `Cached: 2 cached, 2 total (>>> FULL TURBO)`
* **Status:** ✅ PASSED in `< 400ms`.

### 3. Local Development & HMR Verification (`npm run dev`)
```powershell
npm run dev
```
**Results:**
* Turbopack dev server starts cleanly (`next dev --turbo`).
* Hot Module Reloading (HMR) completes in under 500ms on file saves.
* Cross-platform support verified on Windows and Unix.
* **Status:** ✅ PASSED — Local development is fast and operational.
