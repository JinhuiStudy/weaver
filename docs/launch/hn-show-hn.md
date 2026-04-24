# Show HN: Weaver — Fork agents. Rate them. They evolve. Free forever.

> ⚠️ Draft · 2026-W30 화요일 오전 9 PT 게시 예정. 링크 · 스크린샷 · GIF 당일 업데이트.

## Title options (80자 이하, HN 알고리즘에 유리한 순서)

1. **Show HN: Weaver — fork, rate, and evolve AI agents (open-source, runs on Cloudflare free tier)**
2. Show HN: An evolving-agent network where every prompt can be forked like a CodePen
3. Show HN: Weaver — public AI agents with OTEL trace, genealogy, and nightly mutations

## Body (~1200자)

Hey HN, I'm 박진희 (Jinhui) — a solo dev out of Seoul. For the last 14 weeks I've been building Weaver, an open-source network for **AI agents as evolving, forkable public media**.

Live: https://weaver-web.jinhuistudy.workers.dev  
Repo: https://github.com/JinhuiStudy/weaver (Apache 2.0)

### What it is

- **Fork** — every public agent is reachable at `/@handle/slug`. One click clones its graph (nodes · edges · prompts) into your workspace.
- **Rate** — 👍/👎 after each run. A Wilson-lower-bound fitness score gates the evolution engine.
- **Evolve** — nightly Cron picks top agents, runs five prompt-mutation strategies (concise / specific / cot / role / format) through Workers AI, shadow-evaluates candidates with a small judge model, and surfaces suggestions as `🧬 v2` banners to the creator. Accept → new `agent_versions` row · current pointer flips.

### Why it might be interesting

- Built end-to-end on Cloudflare's free tier: Workers + D1 + Cron + Workers AI + Axiom (free plan). My monthly AWS-equivalent bill is $0. Users pay $0, creators pay $0.
- OTEL spans from day one. Every run is a Cron-driven state machine, each step a span on Axiom.
- `/api/public/agents/:h/:s/feed.json` is a valid JSON Feed 1.1 — any RSS reader picks it up.
- Genealogy tree at `/@h/s/genealogy` walks ancestors + descendants three levels deep.
- Content moderation: keyword blocklist + report flow + admin hide before launch, Llama judge after.

### Stack in four lines

- **Web**: React Router 7 Framework Mode · xyflow canvas · Yjs + IndexedDB for offline edits.
- **Runtime**: Hono on Workers · `scheduled()` Cron every 1 min · D1 as the source of truth.
- **Observability**: `packages/observability` OTLP/HTTP JSON → Axiom.
- **Evolution**: `packages/core/fitness.ts` (Wilson LB) + `mutation.ts` (5 strategies) + `evolve/shadow.ts` judge hook.

### What it is not

- Not LangGraph/Mastra/Dify competition. No enterprise tier, no BYOK-first UX.
- Not a hosted-agent playground for a specific LLM provider. Workers AI is the default; you can plug your own key if you hit the free-tier cap.

### What I'd love feedback on

1. The **fork + evolve loop** — does it feel like remixing CodePen, or does it feel noisy?
2. The **$0 forever** ceiling — can I really serve 200 DAU inside Workers AI's 10k neurons/day? The math is in `/docs` but I want someone to poke holes.
3. The **moderation-first launch**: blocklist → 🚩 report → admin hide. Is this enough for a small public network in 2026?

Thanks for reading. Happy to dig into any layer in the comments.

— jinhui · dev.park.jinhui@gmail.com · [@JinhuiStudy](https://github.com/JinhuiStudy)
