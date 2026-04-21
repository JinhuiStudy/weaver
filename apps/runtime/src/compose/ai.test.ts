import { describe, expect, it } from "vitest";
import { type AiBinding, composeWithAi } from "./ai";
import type { CanvasSnapshot } from "./stub";

/**
 * Workers AI doesn't exist in a raw Vitest process — we test against an
 * `AiBinding` interface that mirrors the subset we actually call
 * (`run(model, input)`). Real deployments inject `env.AI`; these tests
 * inject a recorder or a canned-response mock so the entire compose → diff
 * pipeline stays reviewable without a Cloudflare account.
 */

const emptyCanvas: CanvasSnapshot = { nodes: [], edges: [] };

describe("composeWithAi · canned JSON response", () => {
  it("parses a valid JSON response into ops + applies them", async () => {
    const ai: AiBinding = {
      run: async () => ({
        response: JSON.stringify({
          ops: [{ kind: "add_node", nodeType: "agent" }],
        }),
      }),
    };
    const { intent, canvas } = await composeWithAi({
      ai,
      prompt: "add an agent",
      canvas: emptyCanvas,
    });
    expect(intent.ops).toHaveLength(1);
    expect(canvas.nodes).toHaveLength(1);
    expect(canvas.nodes[0]?.type).toBe("agent");
  });

  it("falls back to the offline stub grammar if the model output is unparseable", async () => {
    const ai: AiBinding = {
      run: async () => ({ response: "I'm sorry Dave, I can't do that" }),
    };
    const { intent, canvas } = await composeWithAi({
      ai,
      prompt: "add an agent node",
      canvas: emptyCanvas,
    });
    // Should have fallen back → stub grammar picked up the "add an agent node".
    expect(intent.ops).toHaveLength(1);
    expect(canvas.nodes).toHaveLength(1);
  });

  it("sends the prompt AND current canvas to the model", async () => {
    const calls: unknown[] = [];
    const ai: AiBinding = {
      run: async (_model, input) => {
        calls.push(input);
        return { response: JSON.stringify({ ops: [] }) };
      },
    };
    await composeWithAi({
      ai,
      prompt: "hello",
      canvas: {
        nodes: [
          {
            id: "n1",
            type: "input",
            position: { x: 0, y: 0 },
            data: { label: "webhook" },
          },
        ],
        edges: [],
      },
    });
    expect(calls).toHaveLength(1);
    const first = calls[0] as { messages?: { content: string }[] };
    const userMsg = first.messages?.find((m) => (m as { role?: string }).role === "user");
    expect(userMsg?.content).toContain("hello");
    expect(userMsg?.content).toContain("webhook");
  });

  it("rejects ops that include unknown node types (schema guard)", async () => {
    const ai: AiBinding = {
      run: async () => ({
        response: JSON.stringify({
          ops: [{ kind: "add_node", nodeType: "mothership" }],
        }),
      }),
    };
    const { intent } = await composeWithAi({
      ai,
      prompt: "trick me",
      canvas: emptyCanvas,
    });
    // A bad AI response should fall through to the stub parser, which will
    // either match something legal or return empty-ops with a reason.
    // Valid NodeType union prevents a literal `"mothership"` comparison; cast
    // through string to keep the intent of "AI-injected bogus type" explicit.
    expect(
      intent.ops.every((o) => o.kind !== "add_node" || (o.nodeType as string) !== "mothership"),
    ).toBe(true);
  });
});
