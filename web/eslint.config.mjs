import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '**/node_modules/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Phase 0 guardrail: ban console.log/info to enforce the structured-logger rule
    // documented in design-principles.md. Catches M4 regressions.
    // `warn` and `error` remain allowed for emergency fallback only.
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'warn',
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

export default eslintConfig;
