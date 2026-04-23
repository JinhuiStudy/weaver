import * as v from "valibot";
import { ULID_RE } from "./id";

const UlidSchema = v.pipe(v.string(), v.regex(ULID_RE, "id must be a ULID"));
const UnixMs = v.pipe(v.number(), v.integer(), v.minValue(0));

export const MembershipRoleSchema = v.picklist(["owner", "admin", "member"]);
export type MembershipRole = v.InferOutput<typeof MembershipRoleSchema>;

export const MembershipSchema = v.object({
  user_id: UlidSchema,
  org_id: UlidSchema,
  role: MembershipRoleSchema,
  created_at: UnixMs,
});

export type Membership = v.InferOutput<typeof MembershipSchema>;

export function parseMembership(value: unknown): Membership {
  return v.parse(MembershipSchema, value);
}
