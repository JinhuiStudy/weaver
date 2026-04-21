# ADR-001 — 프로젝트 이름: Weaver

- **상태**: 수락 (2026-04-21)
- **결정권자**: 박진희

## 맥락

프로젝트 이름은 포지셔닝·문화·상품성을 결정한다. 에이전트·툴·관측성·협업을 **하나의 제품**으로 묶는 테제를 반영해야 한다.

## 후보

| 이름 | 장점 | 단점 |
|---|---|---|
| **Weaver** | 엮는 은유, 한·영 모두 발음 자연, 브랜드 감성 | npm weaver 이미 존재 → `weaver-studio` 등 변형 필요 |
| **Loop** | 짧음, 에이전트 feedback loop + dev loop 중의 | 너무 일반적, 고유명사화 어려움 |
| **Prism** | 관측 은유 (빛을 분해) | 관측에 치우침, 빌더 측면 약함 |
| **Looma** | 한국 발음 자연, 깨끗함 | 의미 불명확 |
| **Orchestry** | 오케스트레이션 직관적 | 긺, 발음 어려움 |
| **Anvil** | 제조 은유 | 이미 존재 (anvil.works) |
| **Nexus** | 연결 | 일반명사 |

## 결정

**Weaver**

### 근거
1. **제품 테제와 일치**: 에이전트·툴·관측성·협업 = 여러 가닥 → 직물. Weave는 본질적 동사.
2. **2-3초 내 의미 전달**: 개발자가 듣자마자 "뭔가를 엮는다"고 이해.
3. **한·영 발음**: "위버" / "WEE-vər" 둘 다 자연.
4. **브랜드 확장성**: "Weaver Agent", "Weaver Runtime", "Weaver Hub" 등 파생 용어 깨끗함.
5. **슬로건 친화**: *"Weave agents, tools, and observability into one fabric."*

### 패키지 네이밍
- GitHub org: `getweaver` or `weaver-oss`
- npm scope: `@weaver/core`, `@weaver/canvas`, `@weaver/runtime` 등
- 도메인: `weaver.dev` (구매 필요, $12/년)
- Discord: `discord.gg/weaver`

## 결과 / 대안 거부 이유
- **Loop** — AI agent "feedback loop"가 이미 업계 용어라 브랜드화 어려움. 검색 SEO 불리.
- **Prism** — 관측에 치우친 느낌. 빌더·협업 축이 약해 보임.
- **Anvil** — anvil.works 기존 제품 있음. 혼란.

## 이후 조치
- Week 1: `weaver.dev` 구매, GitHub org `getweaver` 확보
- Week 11: X 계정 `@weaverdev` 개설
