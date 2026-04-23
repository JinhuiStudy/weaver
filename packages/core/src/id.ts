/**
 * 26-char ULID (Crockford base32) implemented on Web Crypto so the same
 * module works in Node, browsers, and Cloudflare Workers. The npm `ulid`
 * package pulls in `require('crypto')` which breaks Workers SSR.
 *
 *   - 10 chars of time  (48 bits, ms precision)
 *   - 16 chars of random (80 bits, from crypto.getRandomValues)
 *
 * Monotonic within distinct milliseconds; within the same ms randomness
 * means sort order is undefined — call sites that need strict monotonicity
 * should wait a tick between ids.
 */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(ms: number): string {
  let out = "";
  let value = ms;
  for (let i = 9; i >= 0; i--) {
    const mod = value % 32;
    out = CROCKFORD[mod] + out;
    value = (value - mod) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 16; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is bounded by the loop
    out += CROCKFORD[bytes[i]! % 32];
  }
  return out;
}

export function newId(): string {
  return encodeTime(Date.now()) + encodeRandom();
}

export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isWeaverId(value: unknown): value is string {
  return typeof value === "string" && ULID_RE.test(value);
}
