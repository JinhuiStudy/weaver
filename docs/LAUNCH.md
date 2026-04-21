# Launch Strategy

> **타깃 런칭일**: 2026-W30 (개발 14주차 월요일)
> **5채널 동시 타격. 3분 데모 영상이 모든 채널의 중심.**

## 1. 5채널 구성

### 1.1 HN (Hacker News)
- **포스트 제목**: `Show HN: Weaver — AI agents as the unit of internal tools`
- **본문 구조** (HN 성공 템플릿):
  1. 한 문장 요약
  2. 무엇을 만들었는지 (기술 스택)
  3. 왜 만들었는지 (개인 동기 — maps-platform 경험)
  4. 기존 솔루션과 차이 (Retool · v0 · Langfuse · n8n 대비)
  5. 데모 링크 + GitHub
  6. 기술적 도전 (가장 어려웠던 부분)
- **발행 시각**: 월요일 오전 9시 PST (화요일 오전 1시 KST)
- **목표**: Front page 유지 4시간+, 댓글 100+

### 1.2 Product Hunt
- **발행 시각**: 화요일 00:01 PST (한국 오후 5시)
- **자산**:
  - 썸네일 1
  - 갤러리 이미지 6 (빌더 · 캔버스 · 트레이스 · eval · 배포 · 멀티유저)
  - 30초 GIF 5개 (각 킬러 피처)
  - 3분 데모 영상
- **Maker comment**: 동기 스토리 + FreeGrow 퇴사 후 자력 프로젝트
- **Hunter**: 가능하면 top hunter 섭외 (힘들면 직접 post)
- **목표**: Daily Top 5, Weekly Top 10

### 1.3 dev.to (영문)
- **시리즈 3편**:
  - Part 1: "Why I built an AI-agent-native internal tool builder in 14 weeks"
  - Part 2: "Cloudflare Durable Objects as an agent runtime — lessons learned"
  - Part 3: "Adding Yjs real-time collaboration to xyflow"
- **1편 발행**: HN 런칭 같은 날
- **2-3편**: 주간 간격

### 1.4 velog / GeekNews (국문)
- "FreeGrow 퇴사 후 14주, AI 에이전트 플랫폼을 만들었습니다"
- 국내 취업·창업 관련 HN 한국판 유입 기대
- X(트위터) 한국 AI 커뮤니티 공유

### 1.5 Discord / Slack 커뮤니티
- **Anthropic Discord** (build 채널)
- **LangChain Discord** (showcase 채널)
- **AI Tinkerers** (지역 모임 + 글로벌 Discord)
- **r/LocalLLaMA, r/programming, r/selfhosted** Reddit
- **한국 AI 개발자 오픈채팅방 5곳**

## 2. 사전 빌드 (Pre-launch, Week 10-13)

### Week 10 — Private Beta 10팀 확보
- 한국 AI 스타트업 직접 outreach (10통 이메일)
- 친구·지인 회사 ops 팀 제공 (5팀 목표)
- 무료 + 피드백 제공 조건
- **목표**: 런칭 시 "이미 50+ 에이전트가 프로덕션에서 돈다"는 수치

### Week 11 — Teaser
- X/Twitter 계정 개설 (@weaverdev or @getweaver)
- 주 3회 포스트 (빌드 중 스크린샷, 기술 해설)
- Waitlist 페이지 (`weaver.dev` 도메인)
- **목표**: Waitlist 500+

### Week 12 — 기술 블로그 2편 미리 게시
- "Durable Objects로 LLM 에이전트 런타임 설계하기" (dev.to)
- "xyflow + Yjs로 멀티유저 캔버스 만들기" (dev.to)
- **목표**: 각 100+ 반응, HN Small Launch 계정 트래픽 테스트

### Week 13 — 데모 영상 제작
- 시나리오 A (CS 환불) — 3분 메인
- 시나리오 B-E — 각 2분
- Loom or ScreenStudio로 직접 녹화
- BGM: 저작권 없음 (Pixabay, YouTube Audio)
- **목표**: 5편 완성, 자막 한·영

## 3. 런칭 주(Week 14) 일정

### 월요일 (D-day)
- **09:00 KST** GitHub public, weaver.dev DNS 완료
- **12:00 KST** X 스레드 (10 트윗, GIF 5)
- **12:00 KST** dev.to Part 1, velog 한글 동시 게시
- **01:00 KST(화)** HN Show HN 게시 (PST 월요일 09:00)
- **02:00 KST(화)** Discord/Slack 커뮤니티 5곳 공유

### 화요일
- **00:01 PST / 17:01 KST** Product Hunt 발행
- 오전 KST: 한국 오픈채팅 공유
- 오후: HN 댓글 전수 답변

### 수요일-금요일
- 피드백 트리아지 → 패치 우선순위
- Issue 첫 기여자 환영 → 컨트리뷰터 확보
- 미디어·블로거 cold outreach (TechCrunch, Ben Thompson, Latent Space)

### 주말
- Week 1 지표 정리 블로그
- 다음 주 Part 2 dev.to 게시 예약

## 4. 핵심 메시지 (모든 채널 공통)

### Hook (한 줄)
> *"AI 에이전트를 내부툴의 원자 단위로 만드는 오픈소스 플랫폼. Retool + Langfuse + v0의 교집합 + 그 이상. **고정 월 비용 $0.**"*

### Why now
> *"2026년, 에이전트는 프로덕션에 배포되기 시작했지만, 운영 인프라가 없다. Langfuse는 관측만, Retool은 AI가 2차 시민, v0는 UI만, n8n은 자동화만. Weaver는 이 네 공백을 하나의 제품으로 차지한다."*

### Why me
> *"FreeGrow에서 10년간 하드웨어부터 클라우드까지 단독 개발. 퇴사 후 10일 만에 maps-platform (408 커밋, 64k 라인, 979 테스트 PASS)을 만든 경험을 바탕으로 Weaver를 14주 안에 런칭한다."*

### CTA
> *"GitHub star + Discord 가입 + Product Hunt 업보트 — 셋 다 30초 안에 끝납니다. `wrangler deploy` 한 줄로 5분 안에 자체 호스팅 시작. 결제카드 없이."*

## 5. 콘텐츠 파이프라인 (런칭 후)

### Month 1
- Part 2-3 dev.to (기술 해설)
- YouTube 시나리오 B-E 데모 영상 개별 업로드
- Podcast 1회 (Latent Space or Changelog)

### Month 2
- Conf talk 지원 (KubeCon NA 2026, Devoxx)
- Customer story (private beta 팀 2곳 케이스 스터디)
- Hacktoberfest 참여 (컨트리뷰터 수 확대)

### Month 3
- YC W27 배치 지원
- Seed round pitch deck 작성
- 첫 유료 고객 수금 (cloud-hosted tier)

## 6. 측정 지표

### D+1 (런칭 당일)
- HN 순위 / 댓글 수
- Product Hunt upvote / 순위
- GitHub star / fork
- Discord 가입 수
- 웹사이트 방문자

### D+7
- 누적 star · download · signup
- Waitlist → activation 전환율
- issue / PR 수
- 미디어 커버리지

### D+30
- MAU
- 자체 호스팅 팀 수
- 유료 고객 수 (있다면)
- 영입 cold outreach 건수

## 7. 위험 관리

| 위험 | 대응 |
|---|---|
| HN front page 실패 | Show HN 재도전 (1개월 후 major 업데이트 시) |
| Product Hunt hunter 섭외 실패 | Self-post + Twitter 인플루언서 RT |
| 기술 이슈로 데모 fail | 3분 영상 미리 녹화, 라이브 데모는 보조 |
| 경쟁 제품 동시 런칭 | 포지셔닝 재프레임 ("X와 우리는 다르다" 블로그) |
| 한국 시장 외면 | velog·geeknews 이중 게시, 영문 중심 |

## 8. 런칭 이후 성공 정의 (3개월)

- GitHub star 2,000+
- Discord 멤버 500+
- 자체 호스팅 팀 50+
- 영입 cold outreach 5+ (Anthropic·Vercel·Retool 중 1곳 포함)
- YC 또는 Tier 1 VC 1차 미팅 확보

---

**최종 목표**: Weaver를 "AI 에이전트 내부툴" 카테고리의 **고유명사**로 만든다.
