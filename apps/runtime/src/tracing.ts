import { pickExporter, Tracer } from "@weaver/observability";

/**
 * Per-invocation Tracer factory. Each Worker request / scheduled tick gets a
 * fresh tracer so:
 *   1. trace_id stays scoped to the thing that actually happened
 *   2. we don't leak spans across isolates (Workers can reuse an isolate)
 *   3. drain() empties the buffer at the end of the invocation
 *
 * The exporter is selected off env: provide `AXIOM_TOKEN` + `AXIOM_DATASET`
 * to ship, omit them for no-op. Production wires both via `wrangler secret`.
 */

export interface TracingEnv {
  AXIOM_TOKEN?: string;
  AXIOM_DATASET?: string;
  AXIOM_ENDPOINT?: string;
  DEPLOYMENT_ENV?: string;
}

export function newTracer(env: TracingEnv): Tracer {
  return new Tracer({
    resource: {
      "service.name": "weaver-runtime",
      "service.version": "0.0.0",
      "deployment.environment": env.DEPLOYMENT_ENV ?? "development",
    },
  });
}

export function newExporter(env: TracingEnv) {
  return pickExporter(env);
}
