# ADR-004 — Collaboration: Yjs Local-first → Phase 2 Real-time

- **상태**: ✅ Phase 1 Implemented (local-first only, 2026-04-21) · 실시간은 post-launch
- **관련**: ADR-006 (Free-tier First), ARCHITECTURE §1, PRODUCT §1 (Feature ③)
- **구현**: `apps/web/app/lib/yjs-provider.ts`, `useCanvasPersistence.ts`

## 맥락

멀티유저가 동일 캔버스를 동시 편집할 수 있어야 한다. 요구사항:

- **Optimistic** — 각자 로컬 변경 즉시 반영
- **Convergence** — 충돌 없이 최종 상태 일치
- **Offline** — 네트워크 끊겨도 편집 가능
- **Awareness** — 커서·선택·presence
- **Persistence** — 서버 재시작해도 문서 유지

**추가 제약 (ADR-006)**: 고정 월 비용 $0.

## 결정

### Phase 1 (MVP, Week 1-14): **Local-first Yjs + D1 스냅샷**

- 각 클라이언트가 **로컬 Y.Doc** 유지 (IndexedDB 영속)
- 변경 시 로컬 즉시 반영 (optimistic, offline 동작)
- 3초 idle 또는 포커스 이탈 시 D1에 `Y.encodeStateAsUpdate()` 스냅샷 저장
- 다른 유저는 페이지 로드/새로고침 시 D1 최신 스냅샷 받아 merge
- **실시간 커서·presence 없음** (트레이드오프)

### Phase 2 (Post-launch, v1.x): **Fly.io 무료 VM에 y-websocket 서버**

- Fly.io 무료 tier: 3x shared-cpu-1x VM (256MB RAM, 영구 무료)
- Docker 컨테이너로 `y-websocket` 서버 호스팅
- 클라이언트 WebSocket 연결 → 실시간 동기화 + awareness
- D1에는 주기적 스냅샷 (영속 백업)
- **비용 $0 유지**

## Phase 1 상세

### 로컬 저장

```typescript
// apps/web/app/lib/yjs-provider.ts
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

export function useCanvasYDoc(canvasId: string) {
  const ydoc = useMemo(() => new Y.Doc(), [canvasId])
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    // 1. IndexedDB 로컬 영속
    const idb = new IndexeddbPersistence(`canvas-${canvasId}`, ydoc)

    idb.on('synced', async () => {
      // 2. D1에서 최신 스냅샷 fetch (다른 디바이스·탭 변경 반영)
      const snapshot = await fetch(`/api/canvas/${canvasId}/snapshot`)
      if (snapshot.ok) {
        const update = await snapshot.arrayBuffer()
        Y.applyUpdate(ydoc, new Uint8Array(update))
      }
      setSyncing(false)
    })

    return () => idb.destroy()
  }, [canvasId, ydoc])

  return { ydoc, syncing }
}
```

### 서버 동기화 (디바운스 저장)

```typescript
// D1 스냅샷 저장
export function useSnapshotSync(ydoc: Y.Doc, canvasId: string) {
  const pendingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const onUpdate = () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingRef.current = setTimeout(async () => {
        const update = Y.encodeStateAsUpdate(ydoc)
        await fetch(`/api/canvas/${canvasId}/snapshot`, {
          method: 'PUT',
          body: update,
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      }, 3000) // 3초 디바운스
    }

    ydoc.on('update', onUpdate)
    return () => ydoc.off('update', onUpdate)
  }, [ydoc, canvasId])
}
```

### Worker 엔드포인트

```typescript
// apps/runtime/src/routes/canvas.ts
app.put('/api/canvas/:id/snapshot', async (c) => {
  const id = c.req.param('id')
  const update = await c.req.arrayBuffer()

  // 기존 스냅샷과 merge (concurrent 저장 시 손실 방지)
  const existing = await c.env.DB.prepare(
    'SELECT y_state FROM canvas_snapshots WHERE canvas_id = ?'
  ).bind(id).first<{ y_state: ArrayBuffer }>()

  let merged: Uint8Array
  if (existing) {
    const doc = new Y.Doc()
    Y.applyUpdate(doc, new Uint8Array(existing.y_state))
    Y.applyUpdate(doc, new Uint8Array(update))
    merged = Y.encodeStateAsUpdate(doc)
  } else {
    merged = new Uint8Array(update)
  }

  await c.env.DB.prepare(`
    INSERT INTO canvas_snapshots (canvas_id, y_state, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(canvas_id) DO UPDATE SET y_state = ?, updated_at = ?
  `).bind(id, merged, Date.now(), merged, Date.now()).run()

  return c.json({ ok: true })
})
```

### D1 스키마

```sql
CREATE TABLE canvas_snapshots (
  canvas_id   TEXT PRIMARY KEY,
  y_state     BLOB NOT NULL,         -- Y.encodeStateAsUpdate 결과
  updated_at  INTEGER NOT NULL
);
```

## Phase 2: Fly.io y-websocket 서버

### 구성

```dockerfile
# fly/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install y-websocket@latest
COPY server.js .
EXPOSE 1234
CMD ["node", "server.js"]
```

```javascript
// fly/server.js
const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('weaver-yjs-server ok')
})

const wss = new WebSocket.Server({ server })
wss.on('connection', (ws, req) => setupWSConnection(ws, req))

server.listen(1234, '0.0.0.0', () => {
  console.log('y-websocket on :1234')
})
```

```toml
# fly/fly.toml
app = "weaver-yjs"
primary_region = "nrt"  # Tokyo

[build]
dockerfile = "Dockerfile"

[http_service]
internal_port = 1234
force_https = true
auto_stop_machines = true     # idle 시 자동 정지 (무료 tier 최적화)
auto_start_machines = true
min_machines_running = 0

[[services.ports]]
  handlers = ["http"]
  port = 80
[[services.ports]]
  handlers = ["tls", "http"]
  port = 443

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"          # 무료 tier 한도
```

### 클라이언트 변경

```typescript
// Phase 2 활성화 시 추가
import { WebsocketProvider } from 'y-websocket'

const provider = new WebsocketProvider(
  'wss://weaver-yjs.fly.dev',
  `canvas-${canvasId}`,
  ydoc,
)

provider.awareness.setLocalStateField('user', {
  id: userId,
  name: userName,
  color: userColor,
})
```

### Awareness UI

- 원격 커서 렌더링
- 선택 하이라이트
- 타이핑 인디케이터

## Trade-off 명시

| 요건 | Phase 1 (MVP $0) | Phase 2 (Fly.io $0) | DO 방식 |
|---|---|---|---|
| Optimistic 로컬 편집 | ✅ | ✅ | ✅ |
| Offline 편집 | ✅ | ✅ | 제한적 |
| Convergence (CRDT) | ✅ | ✅ | ✅ |
| 실시간 presence | ❌ | ✅ | ✅ |
| 실시간 커서 | ❌ | ✅ | ✅ |
| 실시간 동기화 | ❌ (3s 디바운스) | ✅ | ✅ |
| **비용** | **$0** | **$0** | $5/월 |

### 왜 Phase 1 / 2 분리로 충분한가

- MVP 타깃은 "에이전트를 자연어로 만드는 사람". 1인 또는 소규모 팀 편집이 대부분.
- 실시간 멀티 커서는 "편리함"이지 "필수"가 아님.
- 런칭 직후 트래픽 데이터로 Phase 2 필요성 검증 후 배포.

## 위험 · 완화

| 위험 | 완화 |
|---|---|
| 두 유저 동시 편집 시 last-write-wins? | Y.applyUpdate는 CRDT merge. 순서 무관 수렴 |
| Y.Doc 크기 무한 증가 | 주기적 `Y.encodeStateAsUpdate` 후 새 Doc garbage collect |
| D1 BLOB 크기 | 한 canvas <200 노드 가정 시 <100KB. D1 row 제한 1MB 내 |
| Fly.io VM idle 시 정지 | `auto_stop_machines` + WebSocket 요청 시 auto_start (초 단위 복귀) |

## 참고

- [Yjs docs](https://docs.yjs.dev/)
- [y-websocket](https://github.com/yjs/y-websocket)
- [y-indexeddb](https://github.com/yjs/y-indexeddb)
- [Fly.io Free Allowance](https://fly.io/docs/about/pricing/)
