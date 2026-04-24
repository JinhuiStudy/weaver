import { newId } from "@weaver/core";
import type { Context } from "hono";

/**
 * Waitlist signup — no auth required. Accepts (email, source, note) and
 * deduplicates by the (email, source) unique index so a reload doesn't
 * spam the table. Email validation is deliberately loose: we trust the
 * browser's `type=email` field server-side and only reject obviously
 * broken inputs (empty / no '@' / too long).
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_EMAIL_LEN = 254; // RFC 5321 practical upper bound
const MAX_NOTE_LEN = 280;
const SOURCES = new Set(["home", "help", "waitlist", "beta", "launch"]);

export async function handleWaitlist(c: Context): Promise<Response> {
  const db = (c.env as { DB?: D1Database }).DB;
  if (!db) return c.json({ error: "db unavailable" }, 503);

  let body: { email?: unknown; source?: unknown; note?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || rawEmail.length > MAX_EMAIL_LEN || !EMAIL_RE.test(rawEmail)) {
    return c.json({ error: "email is required and must look like an address" }, 400);
  }

  const rawSource =
    typeof body.source === "string" && body.source.trim() ? body.source.trim() : "home";
  if (!SOURCES.has(rawSource)) {
    return c.json({ error: `source must be one of: ${[...SOURCES].join(", ")}` }, 400);
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") {
      return c.json({ error: "note must be a string" }, 400);
    }
    const trimmed = body.note.trim();
    if (trimmed.length > MAX_NOTE_LEN) {
      return c.json({ error: `note must be ≤ ${MAX_NOTE_LEN} chars` }, 400);
    }
    note = trimmed || null;
  }

  // Idempotency: check for an existing row first so we can echo its id back
  // instead of bumping created_at. Tiny race under the hood if two parallel
  // submits race — the UNIQUE (email, source) constraint is the real guard.
  const existing = await db
    .prepare("SELECT id FROM waitlist_signups WHERE email = ? AND source = ?")
    .bind(rawEmail, rawSource)
    .first<{ id: string }>();
  if (existing) {
    return c.json({ id: existing.id, email: rawEmail, source: rawSource, reused: true });
  }

  const id = newId();
  try {
    await db
      .prepare(
        `INSERT INTO waitlist_signups (id, email, source, note, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, rawEmail, rawSource, note, Date.now())
      .run();
  } catch (err) {
    // Race: someone inserted between our SELECT and INSERT. Look it up again.
    const again = await db
      .prepare("SELECT id FROM waitlist_signups WHERE email = ? AND source = ?")
      .bind(rawEmail, rawSource)
      .first<{ id: string }>();
    if (again) {
      return c.json({ id: again.id, email: rawEmail, source: rawSource, reused: true });
    }
    throw err;
  }

  return c.json({ id, email: rawEmail, source: rawSource, reused: false });
}
