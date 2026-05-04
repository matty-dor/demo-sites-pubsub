# Demo Sites — project context (resume guide)

This file summarizes what this repo is for and what we’ve implemented so far. Read it before picking work back up.

## What this project is

A **GrowthLoop-style PoC demo**: mock events (schemas + payloads), optional publish to **Kafka via Confluent REST** on **Vercel**, **dynamic content rules** mapped from a **Personalization API** (or simulated JSON in the browser), and a **Mock Experiences** page that mirrors events with saved rules.

## Repo layout

| Area | Path | Role |
|------|------|------|
| UI | `client/` | Vite + React + TS, Redux + persist, TanStack Query |
| API (optional) | `server/` | Fastify: mock events (Supabase), personalization proxy, optional KafkaJS publish |
| Vercel serverless | `api/publish.js`, `api/personalization.js`, `vercel.json` | Kafka REST publish + GrowthLoop personalization proxy (secrets in Vercel env only) |
| Reference only | `example_event_bridge/` | Example Shopify→Kafka Python app — **gitignored** at repo root (see `.gitignore`) |

## Major behaviors implemented

### Mock Events (`client/src/pages/HomePage.tsx`)

- Cards per event: schema, payload editor, **Dynamic Content Rules**, Trigger.
- **Trigger** uses `useMockEventPublish`: Confluent REST URL if set, else Fastify publish if backend, else simulated envelope in-browser.
- After **successful** publish, **Refresh Experience** can appear (see below).

### Dynamic Content Rules (`client/src/components/DynamicContentRulesSection.tsx`)

- Static vs dynamic content modes; field path (dot notation) into personalization **`data`**.
- Mapping rows include an **Operator** (equals, gt, lt, gte, lte, not equal) and **Example API Response Value** as compare threshold; first matching row wins.
- Preview on Mock Events uses the **simulated** personalization payload from Redux (`simulator` slice).

### Mock Experiences (`client/src/pages/MockContentPage.tsx`)

- Lists events that have **saved** rules (`eventDynamicRules.byEventId`).
- **Live experience** (`MockExperienceLiveRegion`): after trigger, **Refresh Experience** fetches personalization (or uses simulated data locally), shows **loading skeleton first**, then **either** matched rule content **or** default — avoids default-then-swap flash.
- **Saved default** lives in a collapsible reference block.

### Publish / Kafka

- **Preferred path (Option A):** `VITE_CONFLUENT_PUBLISH_URL` → `POST` to Vercel `/api/publish` → Confluent REST (`api/publish.js`). Kafka **record value** = **`payload`** object (GrowthLoop `properties` shape), not a wrapper envelope.
- **Wrong URL caused CORS/404:** must be same-origin `/api/publish` or `https://<deployment-host>/api/publish`, never `vercel.com/...` dashboard URLs.
- **502:** usually Confluent env or host normalization; handler logs `[api/publish]` and returns `details` / `hint`.

### Post-trigger refresh pipeline

- `experienceRefresh` slice: `awaitingRefreshByEventId` set on publish **success** (`useMockEventPublish`), cleared after Refresh.
- **Refresh** calls `fetchPersonalizationSnapshot`: `personalizationHttpEnabled()` → `POST /api/personalization` with `{ customerId }` when `lastPersonalizationCustomerId` is set (or Fastify generic GET `/` when `VITE_USE_BACKEND` only); otherwise simulated store after a paint tick.
- Updates `simulator.personalizationResponse` so Mock Events preview stays aligned.

### Vercel vs Fastify env split

- **`VITE_USE_BACKEND=true`** — mock events load/save via Fastify **`/api/mock-events`** (needs Supabase). Do **not** use alone on pure Vercel static + functions (those routes 404).
- **`VITE_USE_VERCEL_API=true`** with **`VITE_USE_BACKEND` unset/false** — mock events stay **Redux/localStorage**; **`/api/personalization`** uses **`api/personalization.js`** on Vercel. Pair with `PERSONALIZATION_*` in Vercel env.

### Other copy / UX notes

- Header nav: **Mock Experiences** (was Mock Content).
- Dynamic rules labels: “API Response Value and Corresponding Content”, “Example API Response Value”, “Field path to target API Response value”.

## Environment variables (cheat sheet)

### Vercel (project)

**Runtime (functions):**  
`api/publish.js`: Kafka REST vars as before.  
`api/personalization.js`: `PERSONALIZATION_API_BASE_URL`, `PERSONALIZATION_API_PATH_TEMPLATE` (must include `{{customerId}}`), `PERSONALIZATION_API_KEY`; optional `ALLOWED_ORIGINS`.

**Build (Vite client):**  
`VITE_CONFLUENT_PUBLISH_URL` — recommend **`/api/publish`**.  
`VITE_USE_VERCEL_API=true` for personalization proxy **without** full backend (see split above). Do **not** set `VITE_USE_BACKEND=true` on Vercel unless Fastify hosts mock-events API.

### Local client (`client/.env.example`)

Documents `VITE_*` including Confluent publish URL and backend toggle.

### Local / deployed Fastify (`server/.env.example`)

Supabase, personalization proxy, optional **KafkaJS** brokers (optional if only using Vercel REST for publish).

## Persistence

Redux persist whitelist includes `mockEvents`, `eventDynamicRules`, `simulator`, `branding` — **not** `experienceRefresh` (session-only).

## Build / deploy hints

- **Vercel:** Root = repo root (where `vercel.json` + `api/` + `client/` live). Preset **Other**; build/output driven by `vercel.json`. SPA rewrite excludes `/api/*`.

## Resuming work — sensible next steps

1. **Personalization request parity:** Persist or reuse path/method/body from the Personalization page for Refresh (today Refresh uses **GET `/`** when backend is on).
2. **Fastify Kafka body:** If using KafkaJS path, confirm record **value** matches what GrowthLoop expects (Vercel REST path sends `payload` only).
3. **`example_event_bridge`:** Ignored by git; keep a separate clone if you need the Python reference in-repo.

## Key source files (quick index)

- Publish hook: `client/src/hooks/useMockEventPublish.ts`
- Rules + operators: `client/src/store/eventDynamicRulesSlice.ts`, `client/src/lib/ruleMatch.ts`, `client/src/lib/experienceResolve.ts`
- Live experience UI: `client/src/components/MockExperienceLiveRegion.tsx`
- Refresh gate: `client/src/store/experienceRefreshSlice.ts`
- Personalization fetch: `client/src/lib/personalizationClient.ts`
- Vercel producer: `api/publish.js`

---

*Last aligned with implementation in this workspace as of the session that added operators, Mock Experiences refresh flow, and Confluent REST publishing.*
