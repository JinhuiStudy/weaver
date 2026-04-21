import { defineConfig } from "vitest/config";

/**
 * Unit tests — pure functions (stub parser, executor/step, runAgent, cron
 * logic). Fast, no miniflare. Integration tests live under tests/integration
 * with their own config (vitest.integration.config.ts) because they need
 * `cloudflare:test` which isn't available in plain Node.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});
