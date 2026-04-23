import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { newId } from "./id";
import { MembershipRoleSchema, MembershipSchema, parseMembership } from "./membership";

const valid = () => ({
  user_id: newId(),
  org_id: newId(),
  role: "owner" as const,
  created_at: 1_700_000_000_000,
});

describe("MembershipRoleSchema", () => {
  it("accepts owner, admin, member", () => {
    expect(v.parse(MembershipRoleSchema, "owner")).toBe("owner");
    expect(v.parse(MembershipRoleSchema, "admin")).toBe("admin");
    expect(v.parse(MembershipRoleSchema, "member")).toBe("member");
  });

  it("rejects unknown role", () => {
    expect(() => v.parse(MembershipRoleSchema, "superadmin")).toThrow();
  });
});

describe("MembershipSchema", () => {
  it("accepts a valid owner membership", () => {
    const m = v.parse(MembershipSchema, valid());
    expect(m.role).toBe("owner");
  });

  it("rejects non-ULID user_id", () => {
    expect(() => v.parse(MembershipSchema, { ...valid(), user_id: "x" })).toThrow();
  });

  it("rejects non-ULID org_id", () => {
    expect(() => v.parse(MembershipSchema, { ...valid(), org_id: "x" })).toThrow();
  });

  it("parseMembership() returns the parsed membership", () => {
    expect(parseMembership(valid()).role).toBe("owner");
  });
});
