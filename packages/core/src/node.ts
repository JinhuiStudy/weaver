import * as v from "valibot";

export const NodeTypeSchema = v.picklist(["input", "agent", "tool", "branch", "output"]);
export type NodeType = v.InferOutput<typeof NodeTypeSchema>;

const PositionSchema = v.object({
  x: v.number(),
  y: v.number(),
});

const RetryPolicySchema = v.object({
  max_attempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
  backoff: v.picklist(["exponential", "fixed"]),
  initial_ms: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type RetryPolicy = v.InferOutput<typeof RetryPolicySchema>;

const LabelSchema = v.pipe(
  v.string(),
  v.minLength(1, "label is required"),
  v.maxLength(40, "label must be ≤ 40 chars"),
);

const BaseNodeFields = {
  id: v.string(),
  position: PositionSchema,
  label: LabelSchema,
  description: v.optional(v.string()),
  retry: v.optional(RetryPolicySchema),
  timeout_ms: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  version: v.pipe(v.number(), v.integer(), v.minValue(0)),
} as const;

/** Opaque schema reference. User-facing schemas are JSON Schema, kept as unknown here. */
const JsonSchemaLike = v.unknown();

/* ── Input ────────────────────────────────────────────── */

const InputTriggerSchema = v.variant("kind", [
  v.object({
    kind: v.literal("webhook"),
    auth: v.picklist(["none", "hmac", "bearer"]),
  }),
  v.object({ kind: v.literal("schedule"), cron: v.string() }),
  v.object({ kind: v.literal("manual") }),
  v.object({
    kind: v.literal("api"),
    method: v.picklist(["GET", "POST", "PUT", "DELETE"]),
  }),
]);
export type InputTrigger = v.InferOutput<typeof InputTriggerSchema>;

export const InputNodeSchema = v.object({
  ...BaseNodeFields,
  type: v.literal("input"),
  trigger: InputTriggerSchema,
  schema: v.optional(JsonSchemaLike),
});
export type InputNode = v.InferOutput<typeof InputNodeSchema>;

/* ── Agent ────────────────────────────────────────────── */

export const ModelRefSchema = v.string();
export type ModelRef = v.InferOutput<typeof ModelRefSchema>;

const ToolChoiceSchema = v.union([
  v.picklist(["auto", "any", "none"]),
  v.object({ name: v.string() }),
]);
export type ToolChoice = v.InferOutput<typeof ToolChoiceSchema>;

export const AgentNodeSchema = v.object({
  ...BaseNodeFields,
  type: v.literal("agent"),
  model: ModelRefSchema,
  system_prompt: v.string(),
  user_prompt: v.string(),
  output_schema: v.optional(JsonSchemaLike),
  tool_choice: ToolChoiceSchema,
  temperature: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(2))),
  max_tokens: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  use_prompt_cache: v.boolean(),
});
export type AgentNode = v.InferOutput<typeof AgentNodeSchema>;

/* ── Tool ─────────────────────────────────────────────── */

export const ToolNodeSchema = v.object({
  ...BaseNodeFields,
  type: v.literal("tool"),
  tool_id: v.string(),
  input_mapping: v.record(v.string(), v.string()),
  output_variable: v.string(),
});
export type ToolNode = v.InferOutput<typeof ToolNodeSchema>;

/* ── Branch ───────────────────────────────────────────── */

const BranchOutputSchema = v.object({
  id: v.string(),
  label: v.string(),
  value: v.optional(v.string()),
});
export type BranchOutput = v.InferOutput<typeof BranchOutputSchema>;

export const BranchNodeSchema = v.pipe(
  v.object({
    ...BaseNodeFields,
    type: v.literal("branch"),
    condition_kind: v.picklist(["expression", "llm_classifier"]),
    expression: v.optional(v.string()),
    llm_classifier: v.optional(
      v.object({
        prompt: v.string(),
        choices: v.pipe(v.array(v.string()), v.minLength(2)),
        model: ModelRefSchema,
      }),
    ),
    outputs: v.pipe(v.array(BranchOutputSchema), v.minLength(1)),
  }),
  v.forward(
    v.check(
      (n) =>
        n.condition_kind === "expression"
          ? typeof n.expression === "string" && n.expression.length > 0
          : !!n.llm_classifier,
      "branch must provide matching configuration for its condition_kind",
    ),
    ["expression"],
  ),
);
export type BranchNode = v.InferOutput<typeof BranchNodeSchema>;

/* ── Output ───────────────────────────────────────────── */

const OutputResponseKindSchema = v.variant("kind", [
  v.object({
    kind: v.literal("http_response"),
    status: v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(599)),
  }),
  v.object({ kind: v.literal("webhook"), url: v.pipe(v.string(), v.url()) }),
  v.object({ kind: v.literal("return_value") }),
  v.object({ kind: v.literal("none") }),
]);
export type OutputResponseKind = v.InferOutput<typeof OutputResponseKindSchema>;

export const OutputNodeSchema = v.object({
  ...BaseNodeFields,
  type: v.literal("output"),
  response_kind: OutputResponseKindSchema,
  schema: v.optional(JsonSchemaLike),
});
export type OutputNode = v.InferOutput<typeof OutputNodeSchema>;

/* ── Discriminated union ─────────────────────────────── */

export const NodeSchema = v.variant("type", [
  InputNodeSchema,
  AgentNodeSchema,
  ToolNodeSchema,
  BranchNodeSchema,
  OutputNodeSchema,
]);
export type Node = v.InferOutput<typeof NodeSchema>;

export function parseNode(value: unknown): Node {
  return v.parse(NodeSchema, value);
}

export function isNodeType<T extends NodeType>(
  node: Node,
  type: T,
): node is Extract<Node, { type: T }> {
  return node.type === type;
}
