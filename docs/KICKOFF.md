# Kickoff — 0시간부터 첫 커밋까지

> 랩탑 켠 순간부터 **로컬 동작 + Cloudflare Pages 배포**까지. 총 소요: **~3시간**. 전부 **$0**.

## 🗺 단계 요약

| Phase | 작업 | 소요 |
|:-:|---|:-:|
| A | 외부 계정 생성 (5곳) | 30분 |
| B | 로컬 개발 환경 세팅 | 40분 |
| C | 레포 초기화 + 스캐폴드 | 60분 |
| D | Cloudflare 리소스 생성 + 첫 배포 | 30분 |
| E | CI 초기화 + 커밋/푸시 | 20분 |
| **합계** | | **~3시간** |

---

## Phase A — 외부 계정 (30분)

모두 무료. 카드 등록 없음.

### A1. GitHub Organization 생성
1. https://github.com/organizations/new
2. Free plan 선택
3. 이름: **`getweaver`** (또는 `weaver-oss`)
4. 이메일: `dev.park.jinhui@gmail.com`
5. 확인

### A2. Cloudflare 계정 확인
- 기존 계정 사용 가능 (maps-platform 때 생성) — `dev.park.jinhui@gmail.com`
- 로그인 확인: `wrangler whoami`
- 결과 이미 있음 (기존 확인: Account `a727f9b3c38657374e9900c4537c0ed5`)

### A3. Axiom Free 계정
1. https://app.axiom.co/register
2. Free plan — 500GB/월 ingest
3. Dataset 생성: **`weaver-traces`**
4. API Token 발급: Settings → API Tokens → Create
   - 권한: `ingest` + `query`
   - 저장: 1Password 또는 안전한 곳에 (나중 `.dev.vars`에 추가)

### A4. Sentry Developer 계정
1. https://sentry.io/signup/
2. Developer plan (무료, 5k errors/월)
3. Project 생성: **`weaver-web`** (JavaScript/Browser) + **`weaver-runtime`** (Cloudflare Workers)
4. 각 DSN 복사 → 저장

### A5. Anthropic Console (선택, BYOK 테스트용)
- 개발 중 NL composer 테스트에 사용
- https://console.anthropic.com/ — 가입 시 $5 크레딧
- API Key 발급 → 저장

**Phase A 완료 체크리스트**:
- [ ] GitHub org `getweaver` 생성
- [ ] Cloudflare `wrangler whoami` 성공
- [ ] Axiom `AXIOM_TOKEN` 보유
- [ ] Sentry `SENTRY_DSN_WEB` · `SENTRY_DSN_RUNTIME` 보유
- [ ] (선택) Anthropic `ANTHROPIC_API_KEY` 보유

---

## Phase B — 로컬 환경 (40분)

### B1. 필수 도구 설치

```bash
# Node 20+ (이미 있으면 skip)
node --version            # >=20.0.0 확인

# pnpm
npm install -g pnpm@latest
pnpm --version            # >=9.15.0

# wrangler (이미 있음, 최신화)
npm install -g wrangler@latest
wrangler --version

# doppler 불필요 (wrangler secret 사용)
```

### B2. 레포 clone & 구조 확인

```bash
cd ~/Desktop/dev/weaver
ls docs/                  # ADR 6개, spec 6개 확인
cat README.md | head -40
```

### B3. 에디터 설정 (VS Code 권장)

권장 확장:
- Biome (official)
- Tailwind CSS IntelliSense
- ESLint
- Prettier (Biome과 병행하지 말 것)

`.vscode/settings.json` 생성:
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

**Phase B 완료 체크리스트**:
- [ ] Node 20+ 확인
- [ ] pnpm 9.15+ 설치
- [ ] wrangler 최신화
- [ ] VS Code Biome 확장
- [ ] `.vscode/settings.json` 생성

---

## Phase C — 레포 초기화 + 스캐폴드 (60분)

### C1. Git + GitHub repo 연결

```bash
cd ~/Desktop/dev/weaver
git init
git branch -M main
gh repo create getweaver/weaver \
  --public \
  --source=. \
  --description="AI 에이전트를 내부툴의 원자 단위로 만드는 오픈소스 플랫폼" \
  --homepage="https://weaver.pages.dev"
```

### C2. pnpm workspace 초기화

```bash
pnpm install         # package.json 이미 존재
```

### C3. `apps/web` 스캐폴드 (RR7 + Tailwind 4 + shadcn/ui)

```bash
cd apps/web
pnpm create react-router@latest . --template cloudflare --install --git-init=false --package-manager=pnpm
# 대화형 프롬프트에 '기존 디렉토리에 계속 진행' 선택

# Tailwind v4
pnpm add -D tailwindcss@next @tailwindcss/vite@next

# shadcn/ui
pnpm dlx shadcn@latest init
# style=default, color=neutral, CSS vars=Yes

# 기본 컴포넌트
pnpm dlx shadcn@latest add button input card

# tokens.css 연결
cp ../../example/design/tokens.css app/styles/tokens.css
echo '@import "./styles/tokens.css";' >> app/app.css
```

### C4. `apps/runtime` 스캐폴드 (Hono on Workers)

```bash
cd ../runtime
pnpm init
pnpm add hono drizzle-orm
pnpm add -D wrangler @cloudflare/workers-types typescript vitest

# wrangler.toml 생성 (아래 Phase D에서 채움)
```

### C5. `packages/core` 스캐폴드

```bash
cd ../../packages/core
pnpm init
pnpm add valibot ulid
pnpm add -D typescript vitest
# src/index.ts 에 빈 export
mkdir src && echo 'export const WEAVER_VERSION = "0.0.0";' > src/index.ts
```

### C6. 루트 타입체크 & 린트 확인

```bash
cd ../..
pnpm typecheck            # 에러 0
pnpm lint                 # 에러 0
pnpm dev                  # apps/web 기동 → http://localhost:5173
```

**Phase C 완료 체크리스트**:
- [ ] GitHub repo `getweaver/weaver` public
- [ ] `pnpm install` 성공
- [ ] `apps/web` RR7 앱 로컬 기동 (localhost:5173)
- [ ] `apps/runtime` 빈 Hono 앱
- [ ] `packages/core` · 기본 export
- [ ] `tokens.css` import 완료
- [ ] `pnpm typecheck` 0 에러

---

## Phase D — Cloudflare 리소스 + 첫 배포 (30분)

### D1. Cloudflare 리소스 생성 (모두 무료)

```bash
# D1 DB
wrangler d1 create weaver-db
# 출력된 database_id 복사

# R2 버킷
wrangler r2 bucket create weaver-files

# KV 네임스페이스
wrangler kv namespace create FLAGS
# 출력된 id 복사
```

### D2. `apps/runtime/wrangler.toml` 작성

```toml
name = "weaver-runtime"
main = "src/index.ts"
compatibility_date = "2026-04-20"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "weaver-db"
database_id = "위에서 복사한 id"

[[r2_buckets]]
binding = "FILES"
bucket_name = "weaver-files"

[[kv_namespaces]]
binding = "FLAGS"
id = "위에서 복사한 id"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "weaver_counters"

[triggers]
crons = ["* * * * *"]
```

### D3. 시크릿 등록

```bash
cd apps/runtime
wrangler secret put AXIOM_TOKEN          # Phase A3 값
wrangler secret put AXIOM_DATASET        # weaver-traces
wrangler secret put SENTRY_DSN           # Phase A4 값
wrangler secret put INTERNAL_TOKEN       # openssl rand -hex 32
```

### D4. 로컬 개발용 `.dev.vars`

```bash
cat > .dev.vars << 'EOF'
AXIOM_TOKEN=...
AXIOM_DATASET=weaver-traces
SENTRY_DSN=...
INTERNAL_TOKEN=...
EOF
```

### D5. Hono 기본 라우트

`apps/runtime/src/index.ts`:
```typescript
import { Hono } from 'hono'

type Env = { Bindings: CloudflareBindings }
const app = new Hono<Env>()

app.get('/', (c) => c.text('weaver-runtime ok'))
app.get('/health', (c) => c.json({ ok: true, version: '0.0.0' }))

export default {
  fetch: app.fetch,
  scheduled: async (_event, _env, _ctx) => {
    // Week 4에서 executeOneStep 연결
  }
}
```

### D6. 첫 배포

```bash
# apps/runtime
cd apps/runtime
wrangler deploy                         # 결과: https://weaver-runtime.<subdomain>.workers.dev
curl https://weaver-runtime.<sub>.workers.dev/health

# apps/web
cd ../web
pnpm build
wrangler pages deploy ./build/client --project-name=weaver
# 결과: https://weaver.pages.dev
```

**Phase D 완료 체크리스트**:
- [ ] D1 DB 생성 & ID 기록
- [ ] R2 bucket 생성
- [ ] KV namespace 생성 & ID 기록
- [ ] `wrangler.toml` 작성
- [ ] 시크릿 4개 등록
- [ ] `.dev.vars` 생성 (gitignore 확인)
- [ ] `weaver-runtime.workers.dev/health` → ok
- [ ] `weaver.pages.dev` → RR7 홈

---

## Phase E — CI + 첫 커밋 (20분)

### E1. GitHub Actions 워크플로우

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:run
      - run: pnpm build
```

### E2. 배포 워크플로우 (main push 시 자동)

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push: { branches: [main] }

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter=./apps/web build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy ./apps/web/build/client --project-name=weaver

  deploy-runtime:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/runtime
          command: deploy
```

### E3. GitHub repo secrets

https://github.com/getweaver/weaver/settings/secrets/actions
- `CLOUDFLARE_API_TOKEN` — https://dash.cloudflare.com/profile/api-tokens → "Edit Cloudflare Workers" 템플릿

### E4. 첫 커밋

```bash
cd ~/Desktop/dev/weaver
git add .
git commit -m "feat: phase-0 scaffold — RR7 + Hono + tokens

- pnpm workspace (apps, packages, docs, specs, example)
- apps/web: React Router v7 Framework Mode + Tailwind 4 + shadcn/ui
- apps/runtime: Hono + Cloudflare Workers (health endpoint)
- packages/core: valibot + ulid 기본 export
- tokens.css → Tailwind v4 @theme 바인딩
- GitHub Actions: CI + Deploy (Cloudflare Pages + Workers)
- 전 스택 \$0 (ADR-006)"

git push -u origin main
```

**Phase E 완료 체크리스트**:
- [ ] `.github/workflows/ci.yml` 커밋
- [ ] `.github/workflows/deploy.yml` 커밋
- [ ] GitHub repo secret `CLOUDFLARE_API_TOKEN` 등록
- [ ] 첫 커밋 push → CI 그린 확인
- [ ] Cloudflare Pages · Worker 자동 배포 확인
- [ ] `weaver.pages.dev` 접속 정상

---

## 🎉 Kickoff 완료!

이 시점에서:
- ✅ GitHub repo `getweaver/weaver` public
- ✅ `weaver.pages.dev` 접속 가능 (RR7 홈)
- ✅ `weaver-runtime.<subdomain>.workers.dev/health` → `{ok: true}`
- ✅ CI 그린
- ✅ 자동 배포 파이프라인 동작
- ✅ **고정 비용 $0**

이제 **Week 1 실제 작업 시작** — [`WEEK-1-PLAN.md`](./WEEK-1-PLAN.md) 열기.

---

## 🆘 트러블슈팅

| 증상 | 해결 |
|---|---|
| `wrangler deploy` → not authenticated | `wrangler login` |
| D1 ID 못 찾음 | `wrangler d1 list` |
| Tailwind 4 스타일 미적용 | `app/app.css`에 `@import "tailwindcss";` + tokens.css 순서 확인 |
| RR7 typegen 에러 | `pnpm --filter=./apps/web react-router typegen` |
| Actions CLOUDFLARE_API_TOKEN 오류 | 토큰 권한에 "Edit Cloudflare Workers" 포함 확인 |
| 포트 충돌 | `pnpm dev -- --port 5174` |

## 📎 참고 문서

- [`README.md`](../README.md)
- [`docs/ROADMAP.md`](./ROADMAP.md)
- [`docs/TECH_STACK.md`](./TECH_STACK.md)
- [`docs/decisions/ADR-006-free-tier-first.md`](./decisions/ADR-006-free-tier-first.md)
- [`docs/WEEK-1-PLAN.md`](./WEEK-1-PLAN.md) — 다음 단계
