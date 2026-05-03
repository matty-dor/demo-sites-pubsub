# GrowthLoop PoC demo template

Sales-engineering demo shell: define **mock queue events** with a recursive schema, **trigger** publishes (Kafka when configured), **proxy** the Personalization API from the server, and drive **dynamic images** from API values.

## Layout

| Path | Purpose |
|------|--------|
| `client/` | Vite + React + TypeScript, TanStack Query, React Router, **Redux Toolkit** (optional in-browser “storage” for UI work) |
| `server/` | Fastify API + Supabase persistence + optional Kafka (KafkaJS) |
| `supabase/migrations/` | SQL to run per Supabase project |

When you use the full stack, each **prospect demo** can use its **own Supabase project**, **own API deployment**, and **own Vercel (or Netlify) frontend** — same repo, different env vars and URLs. You can also ship **frontend-only** builds while UI is in progress (see below).

## Prerequisites

- Node 20+ recommended (global `fetch` on the server)
- One Supabase project per live demo **if** you use the API + `VITE_USE_BACKEND=true`
- Optional: Kafka reachable from your API host (or leave unset for validate-only mode)

## 1. Supabase (only when using the API / backend storage)

1. Create a project.
2. Run `supabase/migrations/001_initial.sql` in **SQL Editor** (creates tables + seed row for dynamic content).

## 2. Server (`server/`)

```bash
cd server
cp .env.example .env
# Fill SUPABASE_* and optionally Kafka + Personalization API
npm install
npm run dev
```

API listens on `PORT` (default **3001**). Endpoints include:

- `GET /health`
- `GET/POST /api/mock-events`, `DELETE /api/mock-events/:id`
- `POST /api/mock-events/:id/publish` — validates payload, publishes `{ eventName, mockEventId, payload, publishedAt }` if Kafka env is set
- `GET/PUT /api/dynamic-content` — single panel (fixed UUID)
- `POST /api/personalization` — server-side proxy to `PERSONALIZATION_API_BASE_URL`

## 3. Client (`client/`)

Local dev proxies `/api` and `/health` to `http://localhost:3001` (override with `VITE_PROXY_API` if needed).

```bash
cd client
npm install
npm run dev
```

Optional env (see `client/.env.example`):

- `VITE_USE_BACKEND` — omit or set to anything other than `"true"` to keep **mock events**, **dynamic content rules**, and **simulated personalization JSON** in **Redux + localStorage** (no server). Set to `true` when the Fastify API (and usually Supabase) is wired up.
- `VITE_API_BASE_URL` — when using the API (`VITE_USE_BACKEND=true`), set in production to the full origin of your API (no trailing slash). Leave unset locally to use the Vite dev proxy.
- `VITE_GROWTHLOOP_LOGO_URL`, `VITE_CLIENT_LOGO_URL` — header images.

### UI-only / “v1” mode (no database yet)

With the default (no `VITE_USE_BACKEND`), you can develop and host the **Vercel** static app without any API: the header shows **Storage: local (Redux)**. **Trigger** shows a client-only envelope; **Personalization API** is a JSON textarea that updates the store; **Dynamic Content Rules** (per mock event on the Mock Events page) use that simulated response for image-mapping previews. Data survives refresh via `redux-persist` in this browser. Use **Reset demo data** in the header to clear mock events, rules, and simulated JSON for this browser.

`client/vercel.json` adds a SPA fallback so client-side routes work after `vite build`.

## 4. Deploy sketch

| Piece | Suggestion |
|-------|------------|
| Frontend | **Vercel** (or Netlify): project root `client/`, `npm run build`, output `client/dist`, set env vars as needed |
| API | Render / Fly / Cloud Run: root `server/`, `npm run start` after `npm run build`, set server env vars |
| Data | One Supabase project per demo when `VITE_USE_BACKEND=true` |

Ensure `ALLOWED_ORIGINS` on the server includes your deployed site URL.

## Kafka notes

- Set `KAFKA_BROKERS` (comma-separated) and `KAFKA_TOPIC` per deployment.
- Optional SASL: `KAFKA_USERNAME`, `KAFKA_PASSWORD`; `KAFKA_SSL=false` to disable TLS for local-only brokers.
- If Kafka is **not** configured, **Trigger** still runs **schema validation** and returns `mode: "simulated"` so UI demos work without a cluster.

## Next improvements (optional)

- Delete mock events from the UI when `VITE_USE_BACKEND=true` (local mode already has Delete).
- Custom headers for Personalization proxy (some stacks use `x-api-key` instead of `Authorization`).
- Import/export mock event JSON for faster PoC setup.
