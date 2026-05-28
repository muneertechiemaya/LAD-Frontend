// Basic ESLint config for Next.js + TypeScript
import js from '@eslint/js';
import next from 'eslint-config-next';

export default [
  js(),
  ...next,
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/out/**'],
  },
  {
    // Phase 0 guardrail: ban console.log/info to enforce the structured-logger rule
    // documented in design-principles.md. Catches M4 regressions.
    // `warn` and `error` remain allowed for emergency fallback only.
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Exemptions: scripts and tests can use console.log freely
    files: [
      'scripts/**',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/__tests__/**',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];
