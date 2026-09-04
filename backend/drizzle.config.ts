// ═══════════════════════════════════════════════════════════════════
// EL ORÁCULO — Drizzle Kit Configuration
// ═══════════════════════════════════════════════════════════════════

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema file location
  schema: './src/database/schema.ts',

  // Output directory for migrations
  out: './drizzle',

  // Database configuration
  dialect: 'sqlite',

  dbCredentials: {
    url: process.env.DB_PATH || './data/oraculo.db',
  },

  // Migration settings
  verbose: true,
  strict: true,
});
