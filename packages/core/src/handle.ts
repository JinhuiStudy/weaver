import * as v from "valibot";

/**
 * Public-facing username or workspace slug. Mirrors GitHub's rules so that
 * `users.handle` and `orgs.slug` can both use a single canonical shape:
 *   - 1-39 chars, lowercase alphanumeric with internal hyphens
 *   - no leading/trailing hyphen, no consecutive hyphens
 */
const HANDLE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const HandleSchema = v.pipe(
  v.string(),
  v.minLength(1, "handle is required"),
  v.maxLength(39, "handle must be ≤ 39 chars"),
  v.regex(HANDLE_RE, "handle must be lowercase alphanumeric with internal hyphens"),
);

export type Handle = v.InferOutput<typeof HandleSchema>;

export function handleError(value: string): string | null {
  const result = v.safeParse(HandleSchema, value);
  if (result.success) return null;
  return result.issues[0]?.message ?? "invalid";
}

/**
 * Best-effort cleanup of a free-form input (e.g. GitHub display name) into
 * something that will pass HandleSchema. Caller still has to check collisions
 * at the DB level and append `-2`, `-3`, … on conflict.
 */
export function normalizeHandleCandidate(input: string, fallback = ""): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39)
    .replace(/-+$/g, "");
  return slug || fallback;
}
