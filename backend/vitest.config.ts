// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Vitest Configuration
// ═══════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    // Use vmThreads for better native module support (better-sqlite3)
    pool: 'vmThreads',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@el-oraculo/shared': path.resolve(__dirname, '../shared'),
    },
  },
});
