import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { newId } from "./id";
import { OrgSchema, parseOrg } from "./org";

const validOrg = () => ({
  id: newId(),
  slug: "jinhui-personal",
  name: "Jinhui personal",
  owner_user_id: newId(),
  created_at: 1_700_000_000_000,
});

describe("OrgSchema", () => {
  it("accepts a valid personal org", () => {
    const org = validOrg();
    const o = v.parse(OrgSchema, org);
    expect(o.slug).toBe("jinhui-personal");
    expect(o.owner_user_id).toBe(org.owner_user_id);
  });

  it("rejects invalid slug (uppercase)", () => {
    expect(() => v.parse(OrgSchema, { ...validOrg(), slug: "Bad-Slug" })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => v.parse(OrgSchema, { ...validOrg(), name: "" })).toThrow();
  });

  it("rejects name longer than 80 chars", () => {
    expect(() => v.parse(OrgSchema, { ...validOrg(), name: "a".repeat(81) })).toThrow();
  });

  it("rejects non-ULID owner_user_id", () => {
    expect(() => v.parse(OrgSchema, { ...validOrg(), owner_user_id: "abc" })).toThrow();
  });

  it("parseOrg() returns parsed org", () => {
    const sample = validOrg();
    expect(parseOrg(sample).id).toBe(sample.id);
  });
});
