import * as v from "valibot";
import { HandleSchema } from "./handle";
import { ULID_RE } from "./id";

const UlidSchema = v.pipe(v.string(), v.regex(ULID_RE, "id must be a ULID"));
const UnixMs = v.pipe(v.number(), v.integer(), v.minValue(0));

export const UserSchema = v.object({
  id: UlidSchema,
  github_id: v.pipe(v.number(), v.integer(), v.minValue(1)),
  handle: HandleSchema,
  email: v.nullable(v.pipe(v.string(), v.email("invalid email"))),
  name: v.nullable(v.string()),
  avatar_url: v.nullable(v.pipe(v.string(), v.url("invalid avatar url"))),
  created_at: UnixMs,
  last_seen_at: v.nullable(UnixMs),
});

export type User = v.InferOutput<typeof UserSchema>;

export function parseUser(value: unknown): User {
  return v.parse(UserSchema, value);
}
