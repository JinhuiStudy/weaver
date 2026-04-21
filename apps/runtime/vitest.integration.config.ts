import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Integration tests that boot the real Hono Worker inside a Miniflare
 * sandbox with an in-memory D1 database. Tests here touch the full wire
 * (fetch → Hono handler → D1 SQL) instead of mocking the binding.
 *
 * Unit tests stay on the plain `vitest.config.ts` — keep them separate so
 * we don't pay the miniflare startup cost on fast inner-loop iterations.
 */
export default defineWorkersConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityDate: "2026-04-20",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "weaver-db" },
          d1Persist: false,
        },
      },
    },
  },
});
