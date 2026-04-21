# NEXT — 지금 해야 할 작업

> Week 1 + Phase 1 코어 완료 (2026-04-21). 이 파일은 다음에 무엇을 해야 하는지 우선순위대로 나열합니다.
> Week 단위 큰 그림은 [`ROADMAP.md`](./ROADMAP.md), 여긴 "다음 3-5 PR" 실행 수준.

---

## 상태 요약

**라이브**:
- https://weaver-runtime.jinhuistudy.workers.dev (API + D1 + Cron)
- https://weaver-web.jinhuistudy.workers.dev (RR7 빌더)

**작동 중**:
- NL → graph intent (`POST /api/compose`, Workers AI)
- 실행 생성 + 스냅샷 영속 (`POST /api/runs` → D1)
- Cron 자동 실행 (매 1분, state machine step)
- 빌더 캔버스 (드래그 · 연결 · 인스펙터 · Yjs 로컬 영속)

**아직 안 된 것** (중요도 순):
1. 빌더 UI → Runtime API 완전 연결 (compose diff 수락 플로우, Run 상태 실시간 반영)
2. OTEL tracing (`gen_ai.*` spans → Axiom Free)
3. Tool registry (HTTP/SQL built-in + custom)
4. BYOK UX (Claude/OpenAI 키 저장 + 모델 선택 UI)
5. Eval α (`packages/eval` + 데이터셋 업로드)

---

## Sprint 1 — UI ↔ Runtime 루프 마무리 (~3-4일, 1-2 PR)

**왜 제일 먼저**: 지금 Runtime 은 public API 로 배포됐지만 빌더 UI 가 `POST /api/compose` 와 `POST /api/runs` 를 아직 완전히 활용 못 함. 이 루프가 닫혀야 "AI 로 만들고 돌린다" 기본기 완성.

### Task 1.1 — Compose DiffPreview UI
- **Red test (playwright)**: 빌더 상단에 NL 입력창, "Generate" 버튼, 응답 받으면 diff preview 모달에 added nodes/edges 렌더.
- 구현: `apps/web/app/components/canvas/ComposePrompt.tsx` + `lib/compose.ts` (fetch `/api/compose`).
- 수락 시 Zustand `addNodes`/`addEdges` 호출 + Yjs sync.
- 빌더 내부에서 **Runtime URL 설정**은 `VITE_RUN_URL` 을 base URL 로 일반화해서 `/api/runs`, `/api/compose` 둘 다 같은 prefix 쓰게 정리.
- **스크린샷 검증** 필수: 생성 전/후 · diff 모달 · 수락 후 캔버스.

### Task 1.2 — Run 상태 실시간 반영
- 현재 `/tools/:id/runs/:runId` 페이지는 로더로 1회 fetch. 폴링 추가 (2s 간격, status `complete/failed` 되면 멈춤).
- 서버 측: `GET /api/runs/:id` 엔드포인트 없음 → 추가 (D1 SELECT).
- **스크린샷 검증**: pending → running → complete 전환 3장.

### Task 1.3 — 실행 실패 경로 디스플레이
- 현재 `runAgent` 에러 시 `status='failed'` 로 가지만 UI 에서 `error_message` 표시 안 함.
- `agent_runs` 에 `error_message TEXT` 컬럼 추가 (migration 0003).
- 실패 시 빨간 배너 + retry 버튼.

**Exit**: 빌더에서 "환불 에이전트 만들어줘" → diff 수락 → Run → 결과 실시간 확인.

---

## Sprint 2 — OTEL + Trace Viewer (~5-7일, 2-3 PR)

**왜**: 관측성은 Weaver의 차별점이자 테제. 런칭 전 반드시.

### Task 2.1 — Minimal OTEL SDK
- `packages/observability/` — OTEL tracer (Workers 호환, `@opentelemetry/*` 대신 minimal 직접 구현)
- `gen_ai.*` span attributes (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens` 등)
- 각 `executor/step` 호출마다 span 1개. LLM 호출은 중첩 span.

### Task 2.2 — Axiom OTLP exporter
- Axiom Free 계정 가입 → dataset `weaver` 생성 → API token 발급
- Doppler `AXIOM_TOKEN` 저장
- `packages/observability/axiom.ts` — OTLP/HTTP exporter, **10s batch flush**
- `apps/runtime` 에서 `scheduled()` 종료 시 flush

### Task 2.3 — Trace Viewer (frontend)
- `packages/observability/` 에서 `Trace`, `Span` 타입 공유
- `apps/web/components/trace/TimelineView.tsx` — canvas waterfall (각 span bar)
- `/tools/:id/runs/:runId` 페이지에 trace 패널 붙이기
- Axiom API 에서 단일 trace fetch (APL 쿼리 or raw events endpoint)

**Exit**: 실행 1건 → Axiom 에 5-20 spans → viewer 에서 클릭 시 prompt/response.

---

## Sprint 3 — Tool Registry 기반 (~5일, 2 PR)

### Task 3.1 — `defineTool()` 팩토리
- `packages/core/tool.ts` — `defineTool({ name, input, output, execute })`
- valibot 스키마로 input/output 강제
- permission scope 명시

### Task 3.2 — HTTP 툴 빌트인
- `apps/runtime/tools/builtin/http.ts` — URL · method · auth · response schema
- `executor/step` 의 `tool` 노드 타입에서 툴 이름으로 lookup + 실행
- Secrets: Doppler + wrangler secret → `env.SECRET_XXX` 참조

### Task 3.3 — Custom Tool 추가 UI
- `/admin/tools` 페이지 (나중) or 인스펙터에서 JSON-schema 폼
- D1 `tools` / `tool_versions` 테이블 (Week 2 스펙)

**Exit**: 노드에서 "call shopify.getOrder(id)" → 실 API 호출 → 응답 trace 됨.

---

## Sprint 4 — BYOK & 모델 선택 (~2일, 1 PR)

### Task 4.1 — 유저 API 키 저장
- D1 `user_secrets` (id, org_id, provider, key_hash, salt)
- `/settings/api-keys` UI → POST/DELETE
- Runtime: request header `X-Weaver-BYOK: <token>` 또는 org 단위 DB lookup

### Task 4.2 — 모델 선택 UI
- 노드 인스펙터에 "Model" 드롭다운: Workers AI (Llama 3.3) · Claude Sonnet 4.6 · GPT-4o 등
- 모델별 비용 추정치 표시
- `executor/agent.ts` 에서 provider 라우팅

**Exit**: 인스펙터에서 Claude 고르고 API 키 저장 → 실행 → 실제 Claude 호출 + Axiom 에 `gen_ai.system=anthropic`.

---

## Sprint 5 — Eval α (~5-7일, 2-3 PR)

### Task 5.1 — DSL 파서
- `packages/eval/parser.ts` — `specs/eval-dsl.md` 참조
- YAML 또는 JSON 포맷

### Task 5.2 — Runner
- Cron 기반 또는 on-demand (`POST /api/eval/run`)
- 각 case = 새 `agent_runs` row
- 결과 집계: D1 `eval_runs` 테이블

### Task 5.3 — UI
- `/tools/:id/eval` — 데이터셋 업로드 · 실행 · 정확도/비용/지연 매트릭스

**Exit**: 30건 CSV 업로드 → Eval 실행 → Pass rate 93% 리포트.

---

## 백로그 (나중에)

- **실시간 협업** — y-websocket on Fly.io Free (Phase 2)
- **배포 게이트 + Shadow Traffic** — Week 10 스펙
- **Time-Travel 디버깅** — Week 8 스펙
- **docs-site** — Astro on Cloudflare Pages (Week 13)
- **런칭 페이지 + HN/Product Hunt** — Week 14

---

## 기술 부채 · 정리 (짬날 때)

- [ ] Monaco 통합 (현재 textarea) — 대형 agent 프롬프트 쓰기 불편
- [ ] D1 migration 시스템 체계화 (현재 수동 실행) — `drizzle-kit push` 또는 wrangler d1 migrations CLI 활용
- [ ] `apps/web/wrangler.jsonc` 의 `vars.VALUE_FROM_CLOUDFLARE` 레거시 제거
- [ ] CLAUDE.md 의 "쓰지 않는 유료 서비스" 리스트 재정리 (Doppler 복귀 반영됨)
- [ ] `apps/docs-site` 빈 디렉토리 상태 정리 (Week 13까지 touch 안 할 거면 scaffold 제거)
- [ ] 서브도메인 `jinhuistudy.workers.dev` → 커스텀 도메인 `weaver.dev` 이전 여부 결정 (비용 영향 없음, UX 고려)

---

## 의사결정 필요

- **Pages vs Workers for docs-site**: Astro를 Pages 로 올릴지, Workers 로 통일할지.
- **커스텀 도메인 구매 여부**: `.dev` 라면 ~$12/년. $0 정책 범주에 포함할지 ADR-006 명시 필요.
- **Claude API 공식 지원 시점**: BYOK 로 충분한지, 일부 플랜에 anthropic 기본 포함할지 (후자는 비용 위험).
- **실시간 협업 시작 시점**: 런칭 후로 밀지, Eval 끝낸 뒤 Phase 1.5 로 넣을지.

---

**업데이트 규칙**: Sprint 완료 시 이 파일에서 해당 섹션 제거하고 README + ROADMAP 에 반영. 새 우선순위는 상단에 추가.
