import { encodeOtlpJson } from "./otlp";
import type { Tracer } from "./tracer";

/**
 * Exporters drain a Tracer's finished-span buffer and (optionally) ship the
 * batch to an external store. Workers need this to be fire-and-forget:
 *
 *   scheduled(event, env, ctx) {
 *     ctx.waitUntil(exporter.flush(tracer));
 *   }
 *
 * so network failures don't block or 500 the Worker response.
 */

export interface Exporter {
  flush(tracer: Tracer): Promise<void>;
}

/**
 * Dev / offline default. Drains the tracer so long-lived tracer instances
 * (e.g., module-scoped) don't grow unbounded, but writes nothing.
 */
export class NoopExporter implements Exporter {
  async flush(tracer: Tracer): Promise<void> {
    tracer.drain();
  }
}

export interface AxiomExporterOptions {
  /** Axiom API token — `xait-…` in their dashboard. */
  token: string;
  /** Dataset name — Axiom routes OTLP writes by the `X-Axiom-Dataset` header. */
  dataset: string;
  /** Full OTLP traces URL. Defaults to Axiom's public endpoint. */
  endpoint?: string;
  /** Override for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_AXIOM_TRACES = "https://api.axiom.co/v1/traces";

export class AxiomExporter implements Exporter {
  private readonly token: string;
  private readonly dataset: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AxiomExporterOptions) {
    this.token = options.token;
    this.dataset = options.dataset;
    this.endpoint = options.endpoint ?? DEFAULT_AXIOM_TRACES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async flush(tracer: Tracer): Promise<void> {
    const spans = tracer.drain();
    if (spans.length === 0) return;

    const body = JSON.stringify(encodeOtlpJson(spans));

    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "x-axiom-dataset": this.dataset,
          "content-type": "application/json",
        },
        body,
      });
      if (!res.ok) {
        // Drop the batch rather than retry — the Worker scheduled() lifecycle
        // is short, and Axiom's ingest API is idempotent on its side but we
        // don't want to block the next Cron tick on a dead endpoint.
        const text = await safeReadText(res);
        console.warn(`[axiom-exporter] ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      // Network / DNS / fetch abort — same reasoning as above: log + drop.
      console.warn(
        `[axiom-exporter] fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Env-driven exporter factory. Used by the runtime Worker:
 *
 *   const exporter = pickExporter(env);
 *   ctx.waitUntil(exporter.flush(tracer));
 *
 * Returns NoopExporter when AXIOM_TOKEN is missing so local / free-tier
 * runs never block on network.
 */
export function pickExporter(env: {
  AXIOM_TOKEN?: string;
  AXIOM_DATASET?: string;
  AXIOM_ENDPOINT?: string;
}): Exporter {
  if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) return new NoopExporter();
  return new AxiomExporter({
    token: env.AXIOM_TOKEN,
    dataset: env.AXIOM_DATASET,
    endpoint: env.AXIOM_ENDPOINT,
  });
}
