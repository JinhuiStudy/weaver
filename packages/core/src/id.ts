import { ulid } from "ulid";

/**
 * Monotonic 26-char Crockford base32 id (ULID). Chosen over UUIDv4 because
 * lexicographic order matches insertion order — D1 indexes stay hot and
 * pagination doesn't need a secondary `created_at` tiebreaker.
 */
export function newId(): string {
  return ulid();
}

export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isWeaverId(value: unknown): value is string {
  return typeof value === "string" && ULID_RE.test(value);
}
