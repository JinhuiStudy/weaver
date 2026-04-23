import * as v from "valibot";
import { HandleSchema } from "./handle";
import { ULID_RE } from "./id";

const UlidSchema = v.pipe(v.string(), v.regex(ULID_RE, "id must be a ULID"));
const UnixMs = v.pipe(v.number(), v.integer(), v.minValue(0));

export const OrgSchema = v.object({
  id: UlidSchema,
  slug: HandleSchema,
  name: v.pipe(
    v.string(),
    v.minLength(1, "name is required"),
    v.maxLength(80, "name must be ≤ 80 chars"),
  ),
  owner_user_id: UlidSchema,
  created_at: UnixMs,
});

export type Org = v.InferOutput<typeof OrgSchema>;

export function parseOrg(value: unknown): Org {
  return v.parse(OrgSchema, value);
}
