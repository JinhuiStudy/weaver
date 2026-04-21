/**
 * Create a run via the runtime. URL is configurable the same way the compose
 * lib is — VITE_RUN_URL for local wrangler proxy, defaults to same-origin.
 */
export interface CreateRunInput {
  toolId: string;
  input?: unknown;
}
export interface CreateRunResponse {
  id: string;
  status: string;
  tool_id: string;
}

export async function createRun({ toolId, input }: CreateRunInput): Promise<CreateRunResponse> {
  const url = (import.meta.env.VITE_RUN_URL as string | undefined) ?? "/api/runs";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool_id: toolId, input: input ?? {} }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/runs failed: HTTP ${res.status}`);
  }
  return (await res.json()) as CreateRunResponse;
}
