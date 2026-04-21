import { describe, expect, it } from "vitest";
import type { AiBinding } from "../compose/ai";
import { type AgentNodeConfig, runAgent } from "./agent";

/**
 * runAgent()는 running·current=agent 노드를 실제로 실행하는 경로.
 * 입력: agent config (model/prompts/temperature) + 이전 state + ai binding.
 * 출력: 이 agent의 응답 텍스트 + 업데이트될 run.state 필드.
 *
 * 실 Workers AI는 Vitest에 없으므로 AiBinding mock 주입.
 */

const cfg: AgentNodeConfig = {
  id: "ag1",
  label: "policy_check",
  model: "claude-sonnet-4-6",
  system_prompt: "You are a checker.",
  user_prompt: "Check {{ input.order_id }}",
  temperature: 0.2,
  tool_choice: "auto",
};

describe("runAgent · happy path", () => {
  it("calls the AI binding with model + merged messages + temperature", async () => {
    const calls: Array<{ model: string; input: unknown }> = [];
    const ai: AiBinding = {
      run: async (model, input) => {
        calls.push({ model, input });
        return { response: "refund OK" };
      },
    };
    const out = await runAgent({
      ai,
      config: cfg,
      runContext: { input: { order_id: "ord_42" }, state: {} },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe("claude-sonnet-4-6");
    const payload = calls[0]?.input as {
      messages: { role: string; content: string }[];
      temperature: number;
    };
    expect(payload.messages.some((m) => m.role === "system")).toBe(true);
    expect(payload.temperature).toBe(0.2);
    expect(out.output).toBe("refund OK");
  });

  it("interpolates {{ input.<field> }} in user_prompt", async () => {
    let seen = "";
    const ai: AiBinding = {
      run: async (_m, input) => {
        const payload = input as { messages: { role: string; content: string }[] };
        const user = payload.messages.find((m) => m.role === "user");
        seen = user?.content ?? "";
        return { response: "ok" };
      },
    };
    await runAgent({
      ai,
      config: cfg,
      runContext: { input: { order_id: "ord_42" }, state: {} },
    });
    expect(seen).toContain("ord_42");
    expect(seen).not.toContain("{{ input.order_id }}");
  });

  it("writes output to state under the node label (so downstream can reference it)", async () => {
    const ai: AiBinding = {
      run: async () => ({ response: "approved" }),
    };
    const out = await runAgent({
      ai,
      config: cfg,
      runContext: { input: {}, state: {} },
    });
    expect(out.stateDelta.policy_check).toBe("approved");
  });
});

describe("runAgent · plain-string response fallback", () => {
  it("handles string response (not wrapped)", async () => {
    const ai: AiBinding = {
      run: async () => "plain text reply",
    };
    const out = await runAgent({
      ai,
      config: cfg,
      runContext: { input: {}, state: {} },
    });
    expect(out.output).toBe("plain text reply");
  });
});
