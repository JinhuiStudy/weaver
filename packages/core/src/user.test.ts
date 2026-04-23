import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { newId } from "./id";
import { parseUser, UserSchema } from "./user";

const validUser = () => ({
  id: newId(),
  github_id: 12345,
  handle: "jinhui",
  email: "dev@example.com",
  name: "박진희",
  avatar_url: "https://avatars.githubusercontent.com/u/12345",
  created_at: 1_700_000_000_000,
  last_seen_at: 1_700_000_010_000,
});

describe("UserSchema", () => {
  it("accepts a fully populated user", () => {
    const u = v.parse(UserSchema, validUser());
    expect(u.handle).toBe("jinhui");
    expect(u.github_id).toBe(12345);
  });

  it("accepts null email / name / avatar / last_seen_at (GitHub private email etc.)", () => {
    const u = v.parse(UserSchema, {
      ...validUser(),
      email: null,
      name: null,
      avatar_url: null,
      last_seen_at: null,
    });
    expect(u.email).toBeNull();
    expect(u.name).toBeNull();
    expect(u.last_seen_at).toBeNull();
  });

  it("rejects non-ULID id", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), id: "abc" })).toThrow();
  });

  it("rejects negative github_id", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), github_id: -1 })).toThrow();
  });

  it("rejects invalid handle", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), handle: "BAD!" })).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), email: "not-an-email" })).toThrow();
  });

  it("rejects non-integer created_at", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), created_at: 1.5 })).toThrow();
  });

  it("parseUser() returns the parsed user", () => {
    expect(parseUser(validUser()).handle).toBe("jinhui");
  });
});

describe("UserSchema · id shape", () => {
  it("requires a 26-char ULID", () => {
    expect(() => v.parse(UserSchema, { ...validUser(), id: "01J000000000000000000000" })).toThrow(
      /ULID/,
    );
  });
});
