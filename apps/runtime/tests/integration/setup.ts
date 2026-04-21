import { env } from "cloudflare:test";
import { beforeAll } from "vitest";
// Vite's `?raw` suffix inlines the file as a string at build time — Worker
// runtimes don't ship a node:fs implementation, so we can't readFileSync().
import schemaSql from "../../migrations/0001_agent_runs.sql?raw";

/**
 * Apply the 0001 migration once per test run. Miniflare's `d1Persist: false`
 * means each run starts with an empty SQLite, so running the DDL here is the
 * equivalent of `wrangler d1 execute weaver-db --local --file=…` but scoped
 * to the test harness.
 *
 * D1's `.exec()` wants each statement on a single line and doesn't strip
 * inline SQL comments, so we do that ourselves here rather than loading
 * the raw file via exec.
 */
function splitSqlStatements(sql: string): string[] {
  const stripped = sql
    .split("\n")
    .map(stripInlineComment)
    .filter((line) => line.trim().length > 0)
    .join(" ");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stripInlineComment(line: string): string {
  // Cut at first unquoted `--`. Our schema has no string literals with "--"
  // inside, so a simple single-quote tracker suffices.
  let inSingle = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "'") inSingle = !inSingle;
    if (!inSingle && line[i] === "-" && line[i + 1] === "-") {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

beforeAll(async () => {
  for (const stmt of splitSqlStatements(schemaSql)) {
    await env.DB.prepare(stmt).run();
  }
});
