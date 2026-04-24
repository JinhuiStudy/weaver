# 3-minute demo video script — Weaver launch

> 목표 길이 3:00 · Loom 또는 OBS · 1080p · dark mode. 음성 한국어, 자막 영문.

## Opening (0:00–0:15)

- 홈 hero 가 천천히 떠오름. "Fork agents. Rate them. They evolve."
- voice: "Weaver 는 AI 에이전트를 공개하고, 포크하고, 매일 밤 자동 진화시키는 오픈소스 네트워크예요. 유저 $0 · 운영 $0."

## Scene 1 · 공개 agent 포크 (0:15–0:45)

1. `/explore` 로 이동 — Trending 탭, HN Daily Digest 카드.
2. 카드 클릭 → `/@alex/hn-digest` 프로필.
3. stats 뱃지 (like ratio · fork count · subscriber) 줌인.
4. "Fork to workspace" 클릭 → `/builder/:new-id` 로 이동.
5. voice: "누군가의 agent 를 한 번에 복제. 그래프 · 프롬프트 · 구독자까지 따로 가져오지 않아도 내 워크스페이스에 살아 있어요."

## Scene 2 · 빌더 + Compose AI (0:45–1:30)

1. 빌더 헤더 — agent 이름 · @slug · visibility 뱃지.
2. `⌘K` 눌러 Compose palette 열기.
3. "add a slack output node" 타이핑, Submit.
4. diff 가 canvas 에 적용되는 애니메이션.
5. Run 버튼 → `/tools/:id/runs/:runId` 로 이동.
6. Run Viewer 에 4-span waterfall · 👍 좋아요 클릭 → toast.
7. voice: "자연어로 노드 추가. 실행은 Cron 이 1분마다 한 step 씩 진행하고 모든 span 이 OTEL 로 기록돼요."

## Scene 3 · Evolution loop (1:30–2:15)

1. `/agents/:id/evolutions` 로 이동.
2. 5 candidates side-by-side diff — win rate 75 / 80 / 50 / 90 / 25%.
3. `Accept v2` 클릭 on role 90% → 토스트 "🧬 v2 로 승격됨".
4. 빌더로 돌아가 agent header "v2" 뱃지.
5. voice: "Workers AI 가 매일 밤 5 가지 방식으로 프롬프트를 미세 변형. shadow eval 에서 60% 넘게 이긴 candidate 만 내가 수락 버튼으로 올려요."

## Scene 4 · Discovery + Subscribe (2:15–2:45)

1. `/me/feed` — 구독한 agent 타임라인.
2. JSON Feed 링크 클릭 — new tab 에 JSON 1.1 표준.
3. `/search?q=news` 카드 2개.
4. voice: "구독은 한 번 누르면 매일 새 output 이 피드로. `/feed.json` 은 RSS 리더에도 바로 꽂혀요."

## Outro (2:45–3:00)

- `/docs` 페이지의 "4-layer stack" 섹션.
- voice: "Apache 2.0 · Cloudflare free tier · 450+ tests. github.com/JinhuiStudy/weaver 에서 별 하나 눌러주시고, waitlist 에 메일 남기면 런칭 주에 초대 코드 드려요."
- 마지막 프레임: "Weaver · 2026-W30 launch"

## 촬영 팁

- 브라우저 확대 125% (가독성) · cursor 두껍게.
- 네트워크 throttle 없음 — 실제 SSR 속도가 셀링 포인트.
- 영문 자막 자동 생성 후 수동 교정 (특히 "fork / rate / evolve" 키워드는 강조).
- 런칭 타이머 맞춰 화요일 오전 9 PT 에 HN + PH 동시 게시.
