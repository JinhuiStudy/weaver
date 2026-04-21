# ADR-005 — License: Apache 2.0 (pending)

- **상태**: 임시 (확정: Week 12까지)
- **관련**: LAUNCH.md, COMPETITION.md §4.1, ADR-006 (Free-tier First)

## 맥락

오픈소스 라이선스는 커뮤니티 · 기업 채택 · 상업화 경로를 결정한다.

## 후보

| 라이선스 | 특성 | 기업 친화도 | 상업화 친화도 |
|---|---|:-:|:-:|
| **MIT** | 최대 자유 | ⭐⭐⭐⭐⭐ | ⭐⭐ (경쟁자도 자유롭게 copy) |
| **Apache 2.0** | 특허 조항 포함 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ (기여 CLA로 방어) |
| **AGPL-3.0** | copyleft, 네트워크 사용 시 공개 | ⭐⭐ | ⭐⭐⭐⭐⭐ (SaaS 경쟁 방어) |
| **BSL (Business Source)** | 기간 후 open source | ⭐⭐⭐ | ⭐⭐⭐⭐ (HashiCorp·MongoDB 모델) |
| **Elastic License 2.0** | 관리형 서비스 금지 | ⭐⭐⭐ | ⭐⭐⭐⭐ |

## 결정 (잠정)

**Apache 2.0** 로 시작하되, Week 12 전까지 재검토.

### 근거

1. **커뮤니티 채택 최대화** — MVP 단계는 채택이 우선. Apache는 거의 모든 기업이 승인.
2. **특허 조항** — 공헌자 특허 grant로 후일 특허 분쟁 방지 (MIT 대비 유의미).
3. **OSS 생태계 표준** — Kubernetes, Apache Kafka, Airflow 등 주요 OSS 라이선스.
4. **클라우드 호스티드로 상업화** — 소스는 무료, 운영·지원·SSO·SLA를 유료로. Apache로도 충분.

### 재검토 트리거

- Week 12 전에 **의미 있는 경쟁 fork** 신호 발견 시 → BSL 전환 고려 (MongoDB·Redis·HashiCorp 모델)
- 대형 클라우드 벤더가 Weaver 호스티드 서비스를 먼저 런칭 시 → Elastic License 전환 고려

### Open Core 구조

- **OSS (Apache 2.0)**:
  - `packages/core`, `packages/canvas`, `packages/runtime`, `packages/observability`, `packages/eval`
  - `apps/web` 단일 테넌트 모드
  - `apps/runtime` 자체 호스팅 용
  - `apps/docs-site`

- **Cloud (private)**:
  - 멀티 테넌시 분리
  - SSO (SAML, Okta)
  - SLA 모니터링
  - 결제 (Stripe)
  - Shadow traffic 통계 대시보드
  - 팀 비교 리포트

## 거부 이유 요약

- **MIT**: 특허 조항 부재, 클라우드 벤더 포크 방어 약함
- **AGPL**: 채택 장벽 너무 높음 (Google·Apple 내부 정책상 사용 금지)
- **BSL**: MVP 단계에서 커뮤니티 채택 저해. 성숙 후 전환 고려
- **Elastic 2.0**: 같은 이유 — 너무 이른 단계

## Contributor License Agreement (CLA)

Week 12까지 결정:
- **Individual CLA** via GitHub Action (CLA Assistant)
- 기업 기여는 별도 서명 프로세스

## 참고

- [Choose a License — Open Core Playbook](https://choosealicense.com)
- Apache 2.0 공식 문서
- OSI approved licenses
- Sentry: BSL 전환 회고 (2019)
- Elastic: Elastic License 2.0 배경
