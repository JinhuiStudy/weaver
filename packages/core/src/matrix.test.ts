import { describe, expect, it } from "vitest";
import { isConnectionAllowed } from "./edge";
import type { NodeType } from "./node";

/**
 * Exhaustive 5×5 connection matrix. If any row changes you should update the
 * wiring in apps/web's `isValidConnection` AND the runtime's graph validator
 * at the same time — keep this test in sync with `specs/node-types.md`'s
 * table and with `packages/core/src/edge.ts`.
 *
 * Encoding: `1` = allowed, `0` = rejected.
 */
const MATRIX: Record<NodeType, Record<NodeType, 0 | 1>> = {
  input: { input: 0, agent: 1, tool: 1, branch: 1, output: 1 },
  agent: { input: 0, agent: 1, tool: 1, branch: 1, output: 1 },
  tool: { input: 0, agent: 1, tool: 1, branch: 1, output: 1 },
  branch: { input: 0, agent: 1, tool: 1, branch: 0, output: 1 },
  output: { input: 0, agent: 0, tool: 0, branch: 0, output: 0 },
};

const TYPES: NodeType[] = ["input", "agent", "tool", "branch", "output"];

describe("isConnectionAllowed · exhaustive 5×5 matrix", () => {
  for (const from of TYPES) {
    for (const to of TYPES) {
      const expected = MATRIX[from][to] === 1;
      it(`${from} → ${to}: ${expected ? "allow" : "reject"}`, () => {
        expect(isConnectionAllowed(from, to)).toBe(expected);
      });
    }
  }

  it("`output` is a terminal sink (row all zeros)", () => {
    for (const to of TYPES) expect(isConnectionAllowed("output", to)).toBe(false);
  });

  it("`input` is a pure source (column all zeros)", () => {
    for (const from of TYPES) expect(isConnectionAllowed(from, "input")).toBe(false);
  });

  it("branch → branch is explicitly banned (dead-end chain)", () => {
    expect(isConnectionAllowed("branch", "branch")).toBe(false);
  });
});
