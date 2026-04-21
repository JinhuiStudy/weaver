import * as v from "valibot";
import type { Node } from "./node";

/**
 * Shared label constraint. Used both by node valibot schemas (`node.ts`) and by
 * UI-side live validators (`Inspector`). Keeping it here avoids drifting
 * per-surface rules — a label that validates in the inspector must round-trip
 * through `NodeSchema` at save time.
 */
export const LabelSchema = v.pipe(
  v.string(),
  v.minLength(1, "label is required"),
  v.maxLength(40, "label must be ≤ 40 chars"),
);

/**
 * Returns the first syntactic error message for `value`, or null if valid.
 * Cheap — runs per keystroke.
 */
export function labelError(value: string): string | null {
  const result = v.safeParse(LabelSchema, value);
  if (result.success) return null;
  return result.issues[0]?.message ?? "invalid";
}

/**
 * Returns a message if `value` collides with another node's label in `siblings`;
 * null otherwise. The own node (`currentId`) is excluded so a user can re-enter
 * their own label without tripping the check.
 *
 * This is the second validation layer — call `labelError()` first; only when
 * that passes does a duplicate check make sense.
 */
export function uniqueLabelError(
  value: string,
  currentId: string,
  siblings: Pick<Node, "id" | "label">[],
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const duplicate = siblings.some((n) => n.id !== currentId && n.label === trimmed);
  return duplicate ? `duplicate label "${trimmed}" — already used` : null;
}
