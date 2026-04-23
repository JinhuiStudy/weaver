import { HandleSchema, ULID_RE } from "@weaver/core";
import * as v from "valibot";

/**
 * HS256 JWT minted by `/auth/callback` after GitHub OAuth, verified on every
 * authenticated request. Stateless — no server-side session store, which keeps
 * us inside the D1 Free tier (no KV reads per request).
 *
 * Payload intentionally small: user id, default org id, public handle. Role and
 * per-org membership lookup happen in the auth middleware after verify.
 */
const UlidSchema = v.pipe(v.string(), v.regex(ULID_RE, "ulid"));
const UnixSeconds = v.pipe(v.number(), v.integer(), v.minValue(0));

export const SessionPayloadSchema = v.object({
  sub: UlidSchema,
  org: UlidSchema,
  handle: HandleSchema,
  iat: UnixSeconds,
  exp: UnixSeconds,
});
export type SessionPayload = v.InferOutput<typeof SessionPayloadSchema>;

export type SessionClaims = Omit<SessionPayload, "iat" | "exp">;

const HEADER = { alg: "HS256", typ: "JWT" } as const;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const pad =
    input.length % 4 === 2
      ? "=="
      : input.length % 4 === 3
        ? "="
        : input.length % 4 === 0
          ? ""
          : null;
  if (pad === null) return null;
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

type HmacUsage = "sign" | "verify";

async function hmacKey(secret: string, usages: readonly HmacUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [...usages],
  );
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bounds already checked by the for-loop
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

export async function signSession(
  claims: SessionClaims,
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = {
    ...claims,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const headerB64 = b64urlEncode(textEncoder.encode(JSON.stringify(HEADER)));
  const payloadB64 = b64urlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret, ["sign"]);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput)),
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

export async function verifySession(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const expected = b64urlDecode(sigB64);
  if (!expected) return null;

  const key = await hmacKey(secret, ["sign"]);
  const actual = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${headerB64}.${payloadB64}`)),
  );
  if (!timingSafeEqual(actual, expected)) return null;

  const headerBytes = b64urlDecode(headerB64);
  if (!headerBytes) return null;
  let header: unknown;
  try {
    header = JSON.parse(textDecoder.decode(headerBytes));
  } catch {
    return null;
  }
  if (!header || typeof header !== "object") return null;
  const h = header as { alg?: unknown; typ?: unknown };
  if (h.alg !== "HS256" || h.typ !== "JWT") return null;

  const payloadBytes = b64urlDecode(payloadB64);
  if (!payloadBytes) return null;
  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(textDecoder.decode(payloadBytes));
  } catch {
    return null;
  }
  const parsed = v.safeParse(SessionPayloadSchema, payloadJson);
  if (!parsed.success) return null;
  if (parsed.output.exp < nowSeconds) return null;
  return parsed.output;
}
