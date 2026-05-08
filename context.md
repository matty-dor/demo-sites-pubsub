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

### Events page (`client/src/pages/HomePage.tsx`)

- Cards per event: schema, payload editor, **Dynamic Content Rules**, Trigger.
- Card title line: **`Event Name: …`**. Collapsible summaries on the card are shortened to **GrowthLoop Event Schema**, **Event Payload**, and **Dynamic Content Rules**.
- **Per card actions**: `Edit` link (always visible) navigates to `/mock-events/:id/edit`; `Delete` button still local-only.
- **Payloads** are stored in Redux **`eventPayloads.byEventId`** (`eventPayloadsSlice`) so the same values drive Trigger, preview, and refresh; seeded via **`ensureDefaultPayloadForEvent`** per card.
- **Trigger** uses `useMockEventPublish`: Confluent REST URL if set, else Fastify publish if backend, else simulated envelope in-browser. Trigger is **gated on payload completeness** — if any input is empty, the click opens the Event Payload section and shows a danger-tinted hint listing the missing keys (`payloadCompleteness.ts`).
- After **successful** publish, **Refresh Experience** can appear (see below).

### Dynamic Content Rules (`client/src/components/DynamicContentRulesSection.tsx`)

- Static vs dynamic content modes; **field path** uses a fixed **`data.`** prefix in the UI (user types the remainder); stored paths always start with **`data.`** and resolve against `{ data: profilePayload }` (`personalizationFieldPath.ts`, `normalizeRulesFieldPath` in `eventDynamicRulesSlice`).
- Mapping rows include an **Operator** (equals, gt, lt, gte, lte, not equal) and **Example API Response Value** as compare threshold; first matching row wins.
- Preview on the Events page uses the **simulated** personalization payload from Redux (`simulator` slice).

### Experiences page (`client/src/pages/MockContentPage.tsx`)

- Lists events that have **saved** rules (`eventDynamicRules.byEventId`).
- **Card header:** Two stacked headings — **`Event Name: X`** and **`Content Rule: Y`**, where **Y** is the Panel title suffix from Dynamic Content Rules (`panelTitleSuffixFromSaved`, `panelTitle.ts`).
- **Live experience** (`MockExperienceLiveRegion`): **`eventSchema`** + **`eventId`**; **`customer_id`** from **`eventPayloads`** (same as Events page). **Saved default** renders **immediately** (before Trigger). **Refresh Experience** fetches personalization and shows full resolution (matched rule or default); loading replaces the live body with a skeleton. **Reset to Default Experience** applies **`forceDefault`** on the **last** fetched payload (no new API call). **Trigger** uses **`payloadsById[eventId]`** like the home card.
- **Saved default** lives in a collapsible reference block.

### Publish / Kafka

- **Preferred path (Option A):** `VITE_CONFLUENT_PUBLISH_URL` → `POST` to Vercel `/api/publish` → Confluent REST (`api/publish.js`). Kafka **record value** = **`payload`** object (GrowthLoop `properties` shape), not a wrapper envelope.
- **Wrong URL caused CORS/404:** must be same-origin `/api/publish` or `https://<deployment-host>/api/publish`, never `vercel.com/...` dashboard URLs.
- **502:** usually Confluent env or host normalization; handler logs `[api/publish]` and returns `details` / `hint`.

### Post-trigger refresh pipeline

- `experienceRefresh` slice: `awaitingRefreshByEventId` set on publish **success** (`useMockEventPublish`), cleared after Refresh.
- **Refresh Experience** (Events card actions and **Experiences** live region) calls `fetchPersonalizationSnapshot` with **`customerIdFromMockEvent`**: `customer_id` is taken **only** from that event’s payload via **`extractCustomerIdFromPayload`** (schema-aligned). It does **not** use the **Personalization API** page’s customer input (`lastPersonalizationCustomerId`). If `customer_id` is missing or blank after trim, the client returns an error for that refresh path instead of falling back to the page field.
- **Personalization page** fetches for debugging still may set **`lastPersonalizationCustomerId`** for ad-hoc calls; that path applies when **`customerIdFromMockEvent`** is omitted (not used for event refresh).
- Otherwise: `personalizationHttpEnabled()` → proxy `POST` with `{ customerId }`; local/simulated path when not using HTTP; Fastify generic GET when backend-only as before.
- Updates `simulator.personalizationResponse` so preview stays aligned.

### Required `customer_id` on event schemas

- **Create event** (`CreateMockEventPage`): the editor seeds **two rows** — a **locked** `customer_id` string (key + type read-only, no Remove button, **Required** pill) and one empty placeholder row. Save is blocked unless the schema still includes the customer_id row, no field key is empty, and no other event has the same name. (`schemaHasRequiredCustomerId`, `schemaHasEmptyKey`, `LOCKED_ROOT_KEYS`, `createInitialEventSchema` in `mockEventSchemaRules.ts`.)
- **Edit event** (`EditMockEventPage`): legacy events without `customer_id` get the locked row auto-prepended via **`withLockedCustomerIdRow`**. Save dispatches `updateMockEvent` (or `PATCH /api/mock-events/:id`) and realigns the stored payload through **`alignPayloadToMockSchema`**. A persistent **`banner-warning`** explains that schema changes may diverge from the registered GrowthLoop schema and prompts re-registration.
- **Server** (`server/src/types.ts`): **`mockEventSchema`** uses **`.superRefine`** so both **`POST`** and **`PATCH`** `/api/mock-events` reject schemas without the root `customer_id` string (parity with client).

### Vercel vs Fastify env split

- **`VITE_USE_BACKEND=true`** — mock events load/save via Fastify **`/api/mock-events`** (needs Supabase). Do **not** use alone on pure Vercel static + functions (those routes 404).
- **`VITE_USE_VERCEL_API=true`** with **`VITE_USE_BACKEND` unset/false** — mock events stay **Redux/localStorage**; **`/api/personalization`** uses **`api/personalization.js`** on Vercel. Pair with `PERSONALIZATION_*` in Vercel env.

### Other copy / UX notes

- Header nav labels: **Events** / **Experiences** / **Personalization API** (the word "Mock" was scrubbed from all user-visible UI text in May 2026; code identifiers, file names, routes, Redux keys, and CSS classes still use the legacy `mock` naming intentionally).
- Dynamic rules mapping labels (rows / field path label text) unchanged; collapsible **summary** lines were shortened to **GrowthLoop Event Schema**, **Event Payload**, **Dynamic Content Rules**.
- **Event name** is restricted to letters / numbers / underscores via **`sanitizeEventName`** (`eventNameRules.ts`); placeholder uses `abandoned_cart`; muted hint reminds about the rule.
- **Duplicate event names** are flagged inline next to the `Event name` label (amber `event-name-duplicate-warning` text plus `input-invalid` border) on both Create and Edit pages via **`useExistingEventNames`** + **`isDuplicateEventName`**. Compare is trimmed + case-insensitive and excludes the current id when editing.
- **Number payload inputs** (`PayloadEditor` `NumberField`): `type="text"` + `inputMode="decimal"`, blank with placeholder `0` when the value is the default `0`, local string draft synced from props only when unfocused; `onKeyDown` blocks non-numeric single keys, **`sanitizeNumberInput`** strips invalid characters and enforces a single leading `-` plus single `.`. Other types rely on their controls (checkbox / structural editor) for type safety.

### Per-event visual accent (Events + Experiences)

- Cards sharing the same **`eventId`** use the same subtle border wash and **themed primary/secondary buttons** inside the card, picked by hashing the id into a fixed palette (`eventTheme.ts`, `getEventThemeStyle`, `.mock-event-card` / `.mock-experience-card` in `index.css`).

### Personalization API page (`client/src/pages/PersonalizationPage.tsx`)

- Lede: "Use the **customer_id** field below to fetch the corresponding data that has been written to the GrowthLoop Personalization API."
- Primary button label: **Call the Personalization API**.
- Response and timestamp are **persisted** in Redux (`simulator.personalizationResponse`, **`simulator.lastPersonalizationFetchedAt`**); the page no longer keeps a local response copy. The Response section is gated on **`lastPersonalizationFetchedAt`** so the seeded stub doesn't appear until at least one real call has succeeded.
- Heading row renders `Response` next to a muted italic **`last fetched at <date, time>`** (browser locale, `dateStyle: 'medium'` + `timeStyle: 'short'`). On error, the previously stored response stays on screen with the old timestamp so users see the cue that data may be stale.

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

Redux persist whitelist includes `mockEvents`, **`eventPayloads`**, `eventDynamicRules`, `simulator` (now also storing **`lastPersonalizationFetchedAt`**), `branding` — **not** `experienceRefresh` (session-only). **Reset demo data** (`DemoResetButton`) clears **`eventPayloads`** along with events and rules (local-only flow).

## Recent interaction summary

### Earlier May 2026 session

1. **`customer_id` + payloads:** Refresh Experience uses **`customer_id`** from each event’s payload (`eventPayloads`, `extractCustomerIdFromPayload`), not the Personalization page field; new events require root **`customer_id`** (string) on client and server.

2. **`data.` field paths:** Dynamic Content Rules paths are rooted at **`data.`** to match API JSON; preview and live resolve wrap profile data as **`{ data: … }`** (`personalizationFieldPath.ts`, `experienceResolve.ts`).

3. **Events page labeling:** **`Event Name: …`** on cards; collapsible summaries **GrowthLoop Event Schema**, **Event Payload**, **Dynamic Content Rules**.

4. **Experiences page labeling:** Stacked **`Event Name:`** / **`Content Rule:`** headers; **Content Rule** shows the Panel title **suffix** only (`panelTitle.ts`).

5. **Per-event color pairing:** Same **`eventId`** → same accent on the Events card and its Experiences card (`eventTheme.ts`).

6. **Live experience lifecycle:** Default content shows **before** Trigger; **Refresh** applies personalization resolution; **Reset to Default Experience** uses **`resolveLiveExperience(..., { forceDefault: true })`** with the last snapshot—supports repeatable demos (`MockExperienceLiveRegion.tsx`).

### May 7, 2026 session

1. **Header + UI copy scrub:** Nav labels became **Events** / **Experiences**. The word "Mock" was removed from every user-visible string (page H1s, error/empty hints, banners, summary text, button labels, demo reset confirm, tooltips). Code identifiers, file names, routes (`/mock-events/...`), Redux keys, and CSS classes stayed on the legacy `mock` naming on purpose.

2. **Trigger gated on payload completeness:** New `payloadCompleteness.ts` provides `isNodeValueComplete`, `isPayloadComplete`, `listIncompleteRootKeys`. `HomePage` controls the Event Payload `<details>` (with a sync `e.currentTarget.open` read in `onToggle` to avoid a null crash inside setState). The Trigger button uses `aria-disabled` (not `disabled`) so the click handler can run; clicking while incomplete opens the section, sets a per-id `triggerAttemptedById` flag, and shows a danger-tinted **`payload-required-hint`** with the missing root keys plus a **`Required fields incomplete`** pill on the summary.

3. **Event name input rules:** `eventNameRules.ts` (`EVENT_NAME_PATTERN`, `sanitizeEventName`, `EVENT_NAME_HINT`) is wired into Create + Edit pages so spaces/punctuation are dropped on every keystroke. Placeholder is `abandoned_cart`.

4. **Duplicate name warning:** `useExistingEventNames(excludeId?)` shares the `['mock-events']` query cache (or Redux) and, with `isDuplicateEventName`, drives a live amber warning to the right of the **Event name** label (`stack-label-row`, `event-name-duplicate-warning`) plus `input-invalid` and `aria-invalid`. Save is disabled while a duplicate exists. Compare is trimmed and case-insensitive; excludes the current id when editing.

5. **Schema editor rework (`SchemaEditor.tsx`):** New fields use **empty `key`** + placeholder `field_key` (no more `field` / `object` / `items` defaults). New props **`lockedKeys`** (`readOnly` key, disabled type select, no Remove, **Required** pill) and **`hideAddButton`**. Helper **`appendNewSchemaField`** lets the parent page render its own Add field button.

6. **Initial Create schema + button order:** `createInitialEventSchema()` returns a locked `customer_id` row plus one empty placeholder row. **Add field** sits to the **left** of **Save event** in the actions row (nested object editors keep their own Add button).

7. **Edit event flow:** New route **`/mock-events/:id/edit`** + page (`EditMockEventPage.tsx`); home cards expose an `Edit` link in `card-head-actions`. Page shows a persistent **`banner-warning`** about GrowthLoop schema drift, runs the same name + key + duplicate validation as Create, auto-prepends a locked `customer_id` for legacy events, and on save dispatches `updateMockEvent` (or PATCH) plus realigns the persisted payload via `alignPayloadToMockSchema`. Server adds **`PATCH /api/mock-events/:id`** with the same Zod validation.

8. **Number input UX (`PayloadEditor` `NumberField`):** `type="text"` + `inputMode="decimal"`, blank-with-`0`-placeholder when the value is `0`; local string draft state with a focus ref so external value changes don't wipe in-progress typing. `onKeyDown` blocks non-numeric single printable keys; **`sanitizeNumberInput`** strips invalid characters from change/paste, enforces one leading `-` and one `.`.

9. **Personalization API page polish:**
   - Lede: "Use the **customer_id** field below to fetch the corresponding data that has been written to the GrowthLoop Personalization API."
   - Button: **Call the Personalization API**.
   - Response + timestamp persisted in `simulator` slice (new **`lastPersonalizationFetchedAt`** field + `setLastPersonalizationFetchedAt` action). Response section gated on the timestamp; on error, the previous response and timestamp remain so the user has a cue the data is stale. Heading row shows `Response` next to muted italic **`last fetched at <medium date, short time>`** (`personalization-response-head`, `personalization-fetched-at`).

## Build / deploy hints

- **Vercel:** Root = repo root (where `vercel.json` + `api/` + `client/` live). Preset **Other**; build/output driven by `vercel.json`. SPA rewrite excludes `/api/*`.

## Resuming work — sensible next steps

1. **Personalization request parity:** If backend-only mode should mirror the Vercel proxy’s POST body for **non–mock-event** flows, align Fastify generic GET vs POST (mock-event refresh already sends **`customerId`** from payload).
2. **Fastify Kafka body:** If using KafkaJS path, confirm record **value** matches what GrowthLoop expects (Vercel REST path sends `payload` only).
3. **`example_event_bridge`:** Ignored by git; keep a separate clone if you need the Python reference in-repo.
4. **Legacy events:** Schemas created before the **`customer_id`** rule may still exist in persisted state; editing/recreating may be needed for refresh to succeed until schema includes root **`customer_id`** (string).

## Key source files (quick index)

- Publish hook: `client/src/hooks/useMockEventPublish.ts`
- Event payloads (per event): `client/src/store/eventPayloadsSlice.ts`
- Payload completeness (Trigger gating): `client/src/lib/payloadCompleteness.ts`
- `customer_id` from aligned payload: `client/src/lib/customerIdFromPayload.ts`
- Schema rules (locked customer_id, empty-key check, initial schema): `client/src/lib/mockEventSchemaRules.ts`
- Event name rules: `client/src/lib/eventNameRules.ts`
- Duplicate name detection: `client/src/hooks/useExistingEventNames.ts`
- Schema editor (lockable rows, hideable add button): `client/src/components/SchemaEditor.tsx`
- Number payload input (sanitized, placeholder-aware): `client/src/components/PayloadEditor.tsx` (`NumberField`)
- Rules + operators: `client/src/store/eventDynamicRulesSlice.ts`, `client/src/lib/ruleMatch.ts`, `client/src/lib/experienceResolve.ts` (`forceDefault` option)
- Field path `data.` helpers: `client/src/lib/personalizationFieldPath.ts`
- Panel title suffix for Experiences header: `client/src/lib/panelTitle.ts`
- Per-event card/button accents: `client/src/lib/eventTheme.ts`
- Live experience UI: `client/src/components/MockExperienceLiveRegion.tsx`
- Refresh gate: `client/src/store/experienceRefreshSlice.ts`
- Personalization fetch: `client/src/lib/personalizationClient.ts` (`customerIdFromMockEvent` vs page-driven path)
- Create event page: `client/src/pages/CreateMockEventPage.tsx`
- Edit event page (warning banner, schema realignment): `client/src/pages/EditMockEventPage.tsx`
- Personalization API page (persisted response + timestamp): `client/src/pages/PersonalizationPage.tsx`
- Mock events Redux slice (`addMockEvent`, `updateMockEvent`, `removeMockEvent`): `client/src/store/mockEventsSlice.ts`
- Server mock-event validation + PATCH route: `server/src/types.ts`, `server/src/routes/mockEvents.ts`
- Demo reset: `client/src/components/DemoResetButton.tsx`
- Vercel producer: `api/publish.js`

---

*Last aligned with implementation in this workspace as of the **May 7, 2026** session: nav copy scrub, payload-completeness Trigger gating, event name rules + duplicate warning, locked `customer_id` schema editor + Edit event flow, number input sanitization, and Personalization API page persistence + `last fetched at` cue.*
