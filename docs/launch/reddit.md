# Reddit launch drafts — Weaver

> 각 서브마다 분위기/규칙이 다름. 먼저 karma 쌓고, 유료 승격 금지, self-promotion 제한 서브는 Show 태그 확인.

## r/SideProject — "I spent 14 weeks building a public network where AI agents fork & evolve"

```
Hey /r/SideProject — solo dev, 14 weeks, open source.

Weaver (https://weaver-web.jinhuistudy.workers.dev) is my attempt to make AI agents feel like CodePen pens: every public agent has an @handle/slug URL, one click forks the full graph + prompts into your workspace, and a nightly Cron runs 5 prompt-mutation strategies through Workers AI to suggest v2 candidates to the creator.

Stack:
- Cloudflare Workers + D1 + Cron + Workers AI (free tier — $0/month)
- React Router 7 · xyflow canvas · Yjs offline-first
- OTEL → Axiom for trace
- Apache 2.0 · 450+ tests

I'm most proud of keeping the user cost at $0 while still having observability, eval, and evolution loops. Run cap is 10/day, Workers AI neurons 50/day per user — enough for real use, brutal enough that I had to engineer actual fitness scoring.

Repo: https://github.com/JinhuiStudy/weaver
Docs: /docs on the site
Feedback wanted: does the fork-and-evolve loop actually feel fun, or overwhelming?
```

## r/LocalLLaMA — "Free public agent network built on Cloudflare Workers AI (Llama-3.3-70B default)"

```
Built a tiny agent-network site on Cloudflare's free tier. Default model is Llama-3.3-70B via Workers AI — you don't need your own key to try it.

Features for this sub:
- BYOK fallback for Claude / OpenAI if you hit the 50-neuron/day Weaver cap
- Prompt mutations via 5 deterministic strategies (concise, specific, CoT, role, format), then Llama-3B judges pairwise win rate
- OTEL traces on every run (Axiom free tier)

Running agent examples (seed):
- HN Daily Digest (news)
- GitHub Trending (news)
- CSS Tips Weekly (creative)

Open source, Apache 2.0. Repo: https://github.com/JinhuiStudy/weaver  
Live: https://weaver-web.jinhuistudy.workers.dev

Would love critique from the local-llm crowd on:
1. My shadow-eval judge setup (Llama-3B pairwise preference) — is this a reasonable ranker?
2. The 5 mutation strategies — what's missing? Crossover is planned for v2.
```

## r/webdev — optional, later

```
Built a React Router 7 + xyflow + Yjs app on Cloudflare Workers. SSR + file-based routing + full offline editing. One `pnpm dev` and you get both the web Worker and the runtime Worker talking via a service binding.

Specifically proud of:
- `/help` and `/docs` pages with zero JS framework magic, just RR7 loaders
- dev fallback everywhere — runtime offline? pages still render with mock data
- Playwright screenshots committed for every UI state

Repo: https://github.com/JinhuiStudy/weaver
```

## Posting rules to remember

- **r/SideProject**: okay with links, weekly `Show-and-Tell` threads exist.
- **r/LocalLLaMA**: strict no-shill. Lead with technical meat.
- **r/webdev**: self-promo on Tuesdays only, link must be secondary.
- Don't cross-post within 1 hour. Space across 2 days.
