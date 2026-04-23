import { newId } from "@weaver/core";
import { describe, expect, it } from "vitest";
import { type SessionClaims, signSession, verifySession } from "./jwt";

const SECRET = "super-secret-64-byte-minimum-key-abcdefghijklmnopqrstuvwxyz123456";

function payload(overrides: Partial<SessionClaims> = {}): SessionClaims {
  return {
    sub: newId(),
    org: newId(),
    handle: "jinhui",
    ...overrides,
  };
}

describe("signSession / verifySession · HS256 roundtrip", () => {
  it("verifies a freshly signed token and returns the original payload", async () => {
    const now = 1_700_000_000;
    const input = payload();
    const token = await signSession(input, SECRET, 3600, now);
    const out = await verifySession(token, SECRET, now);
    expect(out).not.toBeNull();
    expect(out?.sub).toBe(input.sub);
    expect(out?.org).toBe(input.org);
    expect(out?.handle).toBe("jinhui");
    expect(out?.iat).toBe(now);
    expect(out?.exp).toBe(now + 3600);
  });

  it("returns a three-segment base64url-encoded string", async () => {
    const token = await signSession(payload(), SECRET, 3600, 1_700_000_000);
    expect(token.split(".")).toHaveLength(3);
    for (const part of token.split(".")) {
      // base64url: no + / = padding
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("rejects a token past its exp", async () => {
    const token = await signSession(payload(), SECRET, 10, 1_700_000_000);
    expect(await verifySession(token, SECRET, 1_700_000_020)).toBeNull();
  });

  it("accepts a token exactly at exp (boundary)", async () => {
    const token = await signSession(payload(), SECRET, 10, 1_700_000_000);
    expect(await verifySession(token, SECRET, 1_700_000_010)).not.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(payload(), SECRET, 3600, 1_700_000_000);
    expect(
      await verifySession(
        token,
        "another-secret-with-64-bytes-abcdefghijklmnopqrstuvwxyz12345678",
        1_700_000_000,
      ),
    ).toBeNull();
  });

  it("rejects a token with a tampered payload (signature mismatch)", async () => {
    const token = await signSession(payload(), SECRET, 3600, 1_700_000_000);
    const [h, , s] = token.split(".");
    // craft a malicious payload that still looks base64url
    const forged = `${h}.eyJzdWIiOiJoYWNrZXIifQ.${s}`;
    expect(await verifySession(forged, SECRET, 1_700_000_000)).toBeNull();
  });

  it("rejects non-JWT shaped input (two segments, random string, empty)", async () => {
    expect(await verifySession("a.b", SECRET, 1_700_000_000)).toBeNull();
    expect(await verifySession("not-a-token", SECRET, 1_700_000_000)).toBeNull();
    expect(await verifySession("", SECRET, 1_700_000_000)).toBeNull();
  });

  it("rejects a token whose payload violates schema (missing sub)", async () => {
    // Manually assemble a token with a payload that is valid base64url JSON
    // but doesn't conform to SessionPayloadSchema.
    const bad = { handle: "jinhui", iat: 1, exp: 9_999_999_999 };
    const enc = (bytes: Uint8Array) => {
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };
    const headerB64 = enc(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const payloadB64 = enc(new TextEncoder().encode(JSON.stringify(bad)));
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput)),
    );
    const token = `${signingInput}.${enc(sig)}`;
    expect(await verifySession(token, SECRET, 1_700_000_000)).toBeNull();
  });

  it("produces different signatures for different payloads", async () => {
    const t1 = await signSession(payload({ handle: "jinhui" }), SECRET, 3600, 1_700_000_000);
    const t2 = await signSession(payload({ handle: "alice" }), SECRET, 3600, 1_700_000_000);
    expect(t1).not.toBe(t2);
  });
});
