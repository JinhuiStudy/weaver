/**
 * OTEL trace/span id generation. Web Crypto only — runs the same in Workers,
 * Node 20+ and browsers without a polyfill.
 *
 * Size per the spec:
 *   trace_id = 16 bytes → 32 lowercase hex chars
 *   span_id  = 8  bytes → 16 lowercase hex chars
 * The all-zero value is reserved ("invalid"), so we re-roll on the (vanishingly
 * rare) collision.
 */

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

function randomHex(byteLen: number, zeroString: string): string {
  for (let attempt = 0; attempt < 4; attempt++) {
    const bytes = new Uint8Array(byteLen);
    crypto.getRandomValues(bytes);
    const hex = bytesToHex(bytes);
    if (hex !== zeroString) return hex;
  }
  // Crypto returned all-zero 4 times in a row → something is very wrong.
  throw new Error("crypto.getRandomValues produced all-zero id repeatedly");
}

export function newTraceId(): string {
  return randomHex(16, "0".repeat(32));
}

export function newSpanId(): string {
  return randomHex(8, "0".repeat(16));
}
