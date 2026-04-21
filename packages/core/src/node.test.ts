import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  AgentNodeSchema,
  BranchNodeSchema,
  InputNodeSchema,
  isNodeType,
  type Node,
  NodeSchema,
  OutputNodeSchema,
  parseNode,
  ToolNodeSchema,
} from "./node.ts";

const baseFields = (overrides: Partial<{ id: string; label: string }> = {}) => ({
  id: overrides.id ?? "01J000000000000000000000",
  position: { x: 0, y: 0 },
  label: overrides.label ?? "demo_node",
  version: 1,
});

describe("InputNodeSchema", () => {
  it("accepts webhook trigger with auth", () => {
    const node = v.parse(InputNodeSchema, {
      ...baseFields(),
      type: "input",
      trigger: { kind: "webhook", auth: "hmac" },
    });
    expect(node.type).toBe("input");
  });

  it("rejects webhook trigger with unknown auth", () => {
    expect(() =>
      v.parse(InputNodeSchema, {
        ...baseFields(),
        type: "input",
        trigger: { kind: "webhook", auth: "mystery" },
      }),
    ).toThrow();
  });

  it("rejects empty labels", () => {
    expect(() =>
      v.parse(InputNodeSchema, {
        ...baseFields({ label: "" }),
        type: "input",
        trigger: { kind: "manual" },
      }),
    ).toThrow(/label is required/);
  });
});

describe("AgentNodeSchema", () => {
  it("accepts a valid Claude agent", () => {
    const node = v.parse(AgentNodeSchema, {
      ...baseFields(),
      type: "agent",
      model: "claude-sonnet-4-6",
      system_prompt: "You are a policy checker.",
      user_prompt: "Check {{ input.order_id }}",
      tool_choice: "auto",
      temperature: 0.2,
      use_prompt_cache: true,
    });
    expect(node.temperature).toBe(0.2);
  });

  it("rejects temperature > 2", () => {
    expect(() =>
      v.parse(AgentNodeSchema, {
        ...baseFields(),
        type: "agent",
        model: "claude-sonnet-4-6",
        system_prompt: "...",
        user_prompt: "...",
        tool_choice: "auto",
        temperature: 3,
        use_prompt_cache: false,
      }),
    ).toThrow();
  });
});

describe("ToolNodeSchema", () => {
  it("accepts HTTP tool with mapping", () => {
    const node = v.parse(ToolNodeSchema, {
      ...baseFields(),
      type: "tool",
      tool_id: "http",
      input_mapping: { url: "{{ input.callback }}" },
      output_variable: "http_result",
    });
    expect(node.tool_id).toBe("http");
  });
});

describe("BranchNodeSchema", () => {
  it("accepts expression branch", () => {
    const node = v.parse(BranchNodeSchema, {
      ...baseFields(),
      type: "branch",
      condition_kind: "expression",
      expression: "agent.score > 0.8",
      outputs: [
        { id: "true", label: "approve" },
        { id: "false", label: "escalate" },
      ],
    });
    expect(node.outputs).toHaveLength(2);
  });

  it("rejects expression branch without expression", () => {
    expect(() =>
      v.parse(BranchNodeSchema, {
        ...baseFields(),
        type: "branch",
        condition_kind: "expression",
        outputs: [{ id: "t", label: "yes" }],
      }),
    ).toThrow(/matching configuration/);
  });

  it("accepts llm_classifier branch with choices", () => {
    const node = v.parse(BranchNodeSchema, {
      ...baseFields(),
      type: "branch",
      condition_kind: "llm_classifier",
      llm_classifier: {
        prompt: "Classify",
        choices: ["approve", "escalate", "reject"],
        model: "claude-sonnet-4-6",
      },
      outputs: [
        { id: "approve", label: "approve", value: "approve" },
        { id: "escalate", label: "escalate", value: "escalate" },
        { id: "reject", label: "reject", value: "reject" },
      ],
    });
    expect(node.outputs).toHaveLength(3);
  });
});

describe("OutputNodeSchema", () => {
  it("accepts http_response with status code", () => {
    const node = v.parse(OutputNodeSchema, {
      ...baseFields(),
      type: "output",
      response_kind: { kind: "http_response", status: 200 },
    });
    if (node.response_kind.kind === "http_response") {
      expect(node.response_kind.status).toBe(200);
    }
  });

  it("rejects invalid webhook url", () => {
    expect(() =>
      v.parse(OutputNodeSchema, {
        ...baseFields(),
        type: "output",
        response_kind: { kind: "webhook", url: "not-a-url" },
      }),
    ).toThrow();
  });
});

describe("NodeSchema (discriminated union)", () => {
  it("routes by type", () => {
    const node: Node = parseNode({
      ...baseFields(),
      type: "input",
      trigger: { kind: "manual" },
    });
    expect(isNodeType(node, "input")).toBe(true);
    expect(isNodeType(node, "agent")).toBe(false);
  });

  it("rejects unknown types", () => {
    expect(() =>
      v.parse(NodeSchema, {
        ...baseFields(),
        type: "mystery",
      }),
    ).toThrow();
  });
});
