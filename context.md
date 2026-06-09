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
- **Trigger** uses `useMockEventPublish`: Confluent REST URL if set, else Fastify publish if backend, else simulated envelope in-browser. Trigger is **gated on payload completeness** — if any input is empty, the click opens the Event Payload section and shows a danger-tinted hint listing the missing keys (`payloadCompleteness.ts`). **Timestamp** schema fields are excluded from completeness (always treated complete); see **Timestamp field type** below.
- **Trigger press feedback:** Event and Experiences cards use class **`mock-event-trigger-btn`** on **Trigger … Event** (and Experiences v2 **Refresh** / **Reset** primary buttons) with **`:active`** invert styling (`index.css`: accent fill → dark `#0b1020` background with accent text/border; per-card **`--event-accent`** on `.mock-experience-card` / `.mock-event-card`).
- After **successful** publish, **Refresh Experience** can appear (see below).

### Dynamic Content Rules — v1 (`client/src/components/DynamicContentRulesSection.tsx`)

- Static vs dynamic content modes; **one global field path** per event (fixed **`data.`** prefix in the UI; user types the remainder); stored paths always start with **`data.`** and resolve against `{ data: profilePayload }` (`personalizationFieldPath.ts`, `normalizeRulesFieldPath` in `eventDynamicRulesSlice`).
- Mapping rows include an **Operator** and threshold value; first matching row wins. Operators (see **Condition operators** below) apply to v1 and v2; v1 still uses a single shared field path per event.
- Threshold UI: **`ConditionOperatorValueField`** — label switches between **Example API Response Value**, **Days**, or disabled for null checks (`operatorThresholdKind` in `ruleMatch.ts`).
- Preview on the Events page uses the **simulated** personalization payload from Redux (`simulator` slice).

### Experiences page (`client/src/pages/MockContentPage.tsx`)

- Lists events that have **saved** rules (`eventDynamicRules.byEventId`).
- **Card header:** Two stacked headings — **`Event Name: X`** and **`Content Rule: Y`**, where **Y** is the Panel title suffix from Dynamic Content Rules (`panelTitleSuffixFromSaved`, `panelTitle.ts`).
- **Live experience** (`MockExperienceLiveRegion`): **`eventSchema`** + **`eventId`**; **`customer_id`** from **`eventPayloads`** (same as Events page). **Saved default** renders **immediately** (before Trigger). **Refresh Experience** fetches personalization and shows full resolution (matched rule or default); loading replaces the live body with a skeleton. **Reset to Default Experience** applies **`forceDefault`** on the **last** fetched payload (no new API call). **Trigger** uses **`payloadsById[eventId]`** like the home card.
- **Saved default** lives in a collapsible reference block.

### Publish / Kafka

- **Preferred path (Option A):** `VITE_CONFLUENT_PUBLISH_URL` → `POST` to Vercel `/api/publish` → Confluent REST (`api/publish.js`). Kafka **record value** = **`payload`** object (GrowthLoop `properties` shape), not a wrapper envelope.
- **Trigger-time timestamps:** Before send, every **`timestamp`** field in the payload (including nested under objects/arrays) is set to **`new Date().toISOString()`** via **`injectTriggerTimestamps`** (`client/src/lib/injectTriggerTimestamps.ts`) in **`useMockEventPublish`** (uses the event’s schema from Redux). Fastify **`POST /api/mock-events/:id/publish`** runs the same injection (`server/src/lib/injectTriggerTimestamps.ts`) before **`validatePayloadAgainstSchema`**. Lets downstream systems compare “when fired” to wall clock.
- **Wrong URL caused CORS/404:** must be same-origin `/api/publish` or `https://<deployment-host>/api/publish`, never `vercel.com/...` dashboard URLs.
- **502:** usually Confluent env or host normalization; handler logs `[api/publish]` and returns `details` / `hint`.

### Post-trigger refresh pipeline

- `experienceRefresh` slice: `awaitingRefreshByEventId` set on publish **success** (`useMockEventPublish`), cleared after Refresh.
- **Refresh Experience** (Events card actions and **Experiences** live region) calls `fetchPersonalizationSnapshot` with **`customerIdFromMockEvent`**: `customer_id` is taken **only** from that event’s payload via **`extractCustomerIdFromPayload`** (schema-aligned). It does **not** use the **Personalization API** page’s customer input (`lastPersonalizationCustomerId`). If `customer_id` is missing or blank after trim, the client returns an error for that refresh path instead of falling back to the page field.
- **Personalization page** fetches for debugging still may set **`lastPersonalizationCustomerId`** for ad-hoc calls; that path applies when **`customerIdFromMockEvent`** is omitted (not used for event refresh).
- Otherwise: `personalizationHttpEnabled()` → proxy `POST` with `{ customerId }`; local/simulated path when not using HTTP; Fastify generic GET when backend-only as before.
- Updates `simulator.personalizationResponse` so preview stays aligned.

### Required `customer_id` on event schemas

- **Create event** (`CreateMockEventPage`): the editor seeds **two rows** — a **locked** `customer_id` row (key read-only, no Remove, **Required** pill; **type** selectable **string** or **number** only) and one empty placeholder row. Save is blocked unless the schema still includes `customer_id` as string or number, no field key is empty, and no other event has the same name. (`schemaHasRequiredCustomerId`, `isValidCustomerIdSchemaField`, `CUSTOMER_ID_FIELD_TYPES`, `LOCKED_ROOT_KEYS`, `createInitialEventSchema` in `mockEventSchemaRules.ts`.)
- **Edit event** (`EditMockEventPage`): legacy events without a valid `customer_id` get the locked row auto-prepended or normalized via **`withLockedCustomerIdRow`** (invalid types on existing `customer_id` coerced to **string**). Save dispatches `updateMockEvent` (or `PATCH /api/mock-events/:id`) and realigns the stored payload through **`alignPayloadToMockSchema`**. A persistent **`banner-warning`** explains that schema changes may diverge from the registered GrowthLoop schema and prompts re-registration.
- **Server** (`server/src/types.ts`): **`mockEventSchema`** **`.superRefine`** requires root **`customer_id`** with type **string or number** (parity with client).
- **`extractCustomerIdFromPayload`** coerces string or number payload values to a string for Personalization refresh.

### Vercel vs Fastify env split

- **`VITE_USE_BACKEND=true`** — mock events load/save via Fastify **`/api/mock-events`** (needs Supabase). Do **not** use alone on pure Vercel static + functions (those routes 404).
- **`VITE_USE_VERCEL_API=true`** with **`VITE_USE_BACKEND` unset/false** — mock events stay **Redux/localStorage**; **`/api/personalization`** uses **`api/personalization.js`** on Vercel. Pair with `PERSONALIZATION_*` in Vercel env.

### Other copy / UX notes

- Header nav (current): **Events** (`/v2`), **Experiences** (`/v2/content`), **Personalization API**. The v1 routes (`/`, `/mock-content`) and pages still work if opened directly, but **Events v1** / **Experiences v1** links were removed from the header so the primary demo path is the v2 sandbox. (Earlier May 2026: nav briefly labeled v1 as "Events v1" / "Experiences v1" and v2 as "Events" / "Experiences" before v1 tabs were hidden.)
- The word "Mock" was scrubbed from all other user-visible UI text in May 2026; code identifiers, file names, routes, Redux keys, and CSS classes still use the legacy `mock` naming intentionally.
- Dynamic rules mapping labels (rows / field path label text) unchanged; collapsible **summary** lines were shortened to **GrowthLoop Event Schema**, **Event Payload**, **Dynamic Content Rules**.
- **Event name** is restricted to letters / numbers / underscores via **`sanitizeEventName`** (`eventNameRules.ts`); placeholder uses `abandoned_cart`; muted hint reminds about the rule.
- **Duplicate event names** are flagged inline next to the `Event name` label (amber `event-name-duplicate-warning` text plus `input-invalid` border) on both Create and Edit pages via **`useExistingEventNames`** + **`isDuplicateEventName`**. Compare is trimmed + case-insensitive and excludes the current id when editing.
- **Number payload inputs** (`PayloadEditor` `NumberField`): `type="text"` + `inputMode="decimal"`, blank with placeholder `0` when the value is the default `0`, local string draft synced from props only when unfocused; `onKeyDown` blocks non-numeric single keys, **`sanitizeNumberInput`** strips invalid characters and enforces a single leading `-` plus single `.`. Other types rely on their controls (checkbox / structural editor) for type safety.

### Timestamp field type (`timestamp`)

- **Schema:** `FieldType` includes **`timestamp`** (`client/src/types/schema.ts`); **`SchemaEditor`** exposes it in the type dropdown. **Server** `fieldTypeSchema` in `server/src/types.ts` includes `timestamp`.
- **Payload editor:** **`timestamp`** renders a **disabled** read-only input with empty value and placeholder *“Timestamp is auto-generated based on when the event is triggered.”* (`.payload-timestamp-readonly` in `index.css`). Users do not edit the value in the UI.
- **Defaults / align / completeness:** `schemaDefaults` and **`alignPayloadToMockSchema`** use **`''`** for timestamp; **`payloadCompleteness`** treats **`timestamp`** as always complete so Trigger is not blocked.
- **JSON schema export:** `jsonSchemaFromMock` emits **`{ type: 'string', format: 'date-time', description: … }`** for GrowthLoop registration.
- **Server validation:** `server/src/lib/validatePayload.ts` validates **`date`** as `YYYY-MM-DD` and **`timestamp`** as a non-empty string parseable by **`Date.parse`** (post-injection ISO strings).

### Per-event visual accent (Events + Experiences)

- Cards sharing the same **`eventId`** use the same subtle border wash and **themed primary/secondary buttons** inside the card, picked by hashing the id into a fixed palette (`eventTheme.ts`, `getEventThemeStyle`, `.mock-event-card` / `.mock-experience-card` / `.mock-experience-v2-card` in `index.css`).

### Events v2 / Experiences v2 (sandbox tracks)

- **Why two tracks:** `Events v2` / `Experiences v2` are header tabs that share the same components as v1 but live in a **completely isolated Redux store** so users can experiment without disturbing v1 demo data.
- **Scope plumbing (`client/src/scope/`):** `ScopeContext.tsx` exposes a `ScopePaths` value (`scopeId`, `events`, `eventsCreate`, `eventsEdit`, `experiences`); `V1_SCOPE_PATHS` (`/`, `/mock-events/...`, `/mock-content`) vs `V2_SCOPE_PATHS` (`/v2`, `/v2/events/...`, `/v2/content`). `useScopePaths()` is consumed by `HomePage`, `MockContentPage`, `CreateMockEventPage`, and `EditMockEventPage` so all internal links are scope-aware.
- **Store factory (`client/src/store/createScopedStore.ts`):** `createScopedAppStore(persistKey)` builds a Redux store + persistor for a unique localStorage key. v1 uses `'growthloop-poc'` (`store/index.ts`); v2 uses `'growthloop-poc-v2'` (`store/v2Store.ts`). The v2 whitelist includes `pageStructure`, `staticContent`, `eventDynamicTargets`, and `experienceV2CardExpand` alongside the original slices.
- **Layout wrapper (`client/src/scope/V2ScopeLayout.tsx`):** wraps every `/v2/*` route with its own `<Provider store={v2Store}>`, `<PersistGate persistor={v2Persistor}>`, fresh `QueryClient`, and `<ScopePathsProvider value={V2_SCOPE_PATHS}>` so v2 has truly separate data, query cache, and routing semantics.
- **"Content" wrapper on Events v2:** `DynamicContentRulesSection` renders one v1 `<details>` (existing form) when `scopeId === 'v1'`. When `scopeId === 'v2'`, it renders a `Content` `<details>` containing three nested collapsibles: **Page Structure** (`PageStructureEditor`), **Static Content** (`StaticContentEditor`), and **Dynamic Content** (`DynamicContentV2Section`). The legacy v1 inner body is no longer rendered for v2.
- **Page Structure (`pageStructureSlice` + `PageStructureEditor`):** rows are `{ id, layout: 'full' | 'half-half', defaultDisplay: 'show' | 'hide' }` (`PageStructureRowLayout`, `PageStructureRowDefaultDisplay`; `normalizePageStructureRow` backfills missing `defaultDisplay` as `'show'`). Editor uses a 1fr/2fr grid — left controls (Edit / Save / Cancel + per-row **Full-Width / 50-50** radios + **Default Display** `<select>` Show/Hide + Add Another Row + Remove) and right preview (`page-structure-preview-row-*`; Hide rows show a small **· Hide** pill in preview). **`isPageStructureRowVisibleForStaticContent(row)`** is true when `defaultDisplay !== 'hide'`. Saved row order drives Static Content (Show rows only) and Dynamic Content (all rows) downstream.
- **Static Content (`staticContentSlice` + `StaticContentEditor`):** per-row blocks (`byRowId[rowId]: StaticBlockContent[]`, length 1 for full, 2 for half-half) for **Show** rows only. **`reconcileForStaticEditor`** filters structure rows through `isPageStructureRowVisibleForStaticContent` before reconcile/save so Hide rows never get `byRowId` keys. If every row is Hide, a muted message directs users to Dynamic Content. Row labels use the **full** page-structure index (`structureRowNumber`) so numbering matches Page Structure. Editor mirrors the 2fr/1fr grid of the Dynamic editor with a **Collapse inputs** toggle that gives the preview full width. Each eligible row is its own `<details>` (new Show rows open by default; Hide row ids are dropped from `openRowIds`). Block Content Type is `text` or `imageUrl`; URL inputs validate via `isValidHttpUrl` and show an inline `static-content-invalid-hint`.
- **Dynamic Content v2 (`eventDynamicTargetsSlice` + `DynamicContentV2Section`):** per-event `V2DynamicConfig { contentSourceMode, targets }` — **no global field path** (legacy persisted `fieldPath` migrates into per-condition rows). Each `V2DynamicTarget` binds **content variations** to a `(rowId, side)` cell (`side: null` full-width, `'A' | 'B'` for 50-50). Each **`V2StaticMappingRow`** has **`conditions: V2MappingCondition[]`** (field path + operator + value); **all conditions must match (AND)**; first matching variation wins. Per-condition field path uses the same **`data.`** prefix UI as v1. **+ Add condition** within a variation; Personalization JSON peek at section top (no global path input). Text **Content** supports **`{{api_value}}`** (first active condition’s value) and **`{{api_value:pathSuffix}}`** (e.g. `{{api_value:segment}}` — suffix = path after `data.`, see `apiValueTemplate.ts` / `interpolateApiValues`). Preview sidebar lists resolved values for all paths in use. Save allows draft incomplete rows; image URL validation unchanged. Matching: `mappingConditions.ts` + `mappingRowMatches` in `ruleMatch.ts`. **+ Add target**, per-target collapsibles, preview grid, **Dynamic** badge — as before (`resolveV2Cell` → static fallback).
- **Static Content editor (Events v2):** preview **Image URL** cells use **edge-to-edge** rendering: `.page-structure-preview-block:has(> .static-content-preview-image)` drops cell padding/min-height and flex-centering; `.static-content-preview-image` is `width: 100%` / `height: auto` so the image fills the row (`index.css`). The same image treatment applies to **Dynamic Content v2** preview cells and **Experiences v2** live cells (`.mock-experience-v2-cell-image` + `:has` on `.mock-experience-v2-cell`).
- **Experiences v2 (`MockExperienceV2Card` + `MockExperienceV2LiveRegion`):** `MockContentPage` branches on `scopeId`; v2 lists events with any saved pageStructure / staticContent / eventDynamicTargets. Card: `<details class="card mock-experience-card mock-experience-v2-card">` + `getEventThemeStyle(eventId)`. **Expand/collapse** is controlled: `open={cardExpanded}` from Redux **`experienceV2CardExpandSlice`** (`expandedByEventId`, persisted on v2 store). **`onToggle`** syncs `expanded` from `e.currentTarget.open` (do **not** `preventDefault()` on `toggle` or flip `!cardExpanded` — that fought React and caused open/closed flashing after navigation/rehydrate). **Summary** (`mock-experience-v2-summary`): first row (`mock-experience-v2-summary-inner`) — disclosure triangle, **Event Name** `h2`, **Trigger {event} Event** (`mock-experience-v2-summary-trigger`, `preventDefault`/`stopPropagation`). **Second row** (`mock-experience-v2-summary-actions`, below the title row): optional “Publish succeeded — use **Refresh Experience**…” copy, then **Refresh Experience** and **Reset to Default Experience** (same `btn-primary` + `mock-event-trigger-btn` accent and press invert as Trigger; `stopPropagation` on the actions strip and each button). Refresh/reset **state** (`personalizationData`, `displaySource`, `loading`, `hasEverRefreshed`, `runRefresh`, `resetToDefaultExperience`) lives on **`MockExperienceV2Card`** and is passed into **`MockExperienceV2LiveRegion`** as full **`personalizationResponse.data`** profile object (not a single pre-resolved scalar). Live region calls **`resolveV2Cell`** with that profile for multi-condition / nested-path rules. Simulated “page” strip (`mock-experience-v2-live-region`): **`background: var(--text)`** canvas; inner cells use `--surface` text color. **Hide rows:** omitted when `forceDefault`; after refresh, Hide rows appear only if a cell **`source === 'matched'`**; no static fallback for Hide rows in live view. CSS: `.mock-experience-v2-summary-actions`, summary **`.btn-primary`** `appearance: none` / `font: inherit`.

### Condition operators & Personalization field paths (`ruleMatch.ts`, `mappingConditions.ts`, `relativeDateMatch.ts`)

Shared by **v1** (single global path per event) and **v2** (path per condition). Resolution uses **`getAtPath`** on `{ data: personalizationResponse.data }` (`personalizationFieldPath.ts`). Dot segments work for nested keys, including numeric object keys (e.g. UI suffix `audiences.37124` → `data.audiences.37124`).

| Operator | Threshold | Behavior |
|----------|-------------|----------|
| Equals / Not equal / GT / LT / GTE / LTE | Example API response value | String compare (ordering ops need finite numbers) |
| **Is null** / **Is not null** | Ignored (disabled in UI) | `undefined` or JSON `null` vs anything else. Use **`audiences.37124`** + **Is not null** for “audience key exists” (resolves to object). |
| **Occurred within the last** / **Did not occur within the last** | **Days** (e.g. `7`, `7 days`) | Parse resolved value as ISO date/time (`Date.parse`); true if instant ∈ `[now − X×24h, now]` (inclusive). Future dates do not match “occurred”. Reference **`Date.now()`** when the rule runs (preview / Experiences refresh). |

Legacy v2 rows (operator + value only, no `conditions[]`) normalize to one condition using migrated global **`fieldPath`** on load (`normalizeV2StaticMappingRow` in `eventDynamicTargetsSlice.ts`).

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

Redux persist whitelist includes `mockEvents`, **`eventPayloads`**, `eventDynamicRules`, `simulator` (now also storing **`lastPersonalizationFetchedAt`**), `branding`, and the v2-specific slices **`pageStructure`**, **`staticContent`**, **`eventDynamicTargets`**, **`experienceV2CardExpand`** — **not** `experienceRefresh` (session-only). v1 persists under the `'growthloop-poc'` localStorage key, v2 under `'growthloop-poc-v2'` (`createScopedAppStore`). **Reset demo data** (`DemoResetButton`) clears v1 events / payloads / rules (the button is rendered against the v1 store; v2 has its own isolated state that survives until the user clears `localStorage` directly).

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

### May 8–9, 2026 session

1. **Dynamic Content Rules polish (v1 + carry-over to v2 chrome):**
   - Field path input now uses a **placeholder** ("Refer to a Personalization API response to insert the proper field path.") instead of seeding a default `segment` value; stored paths still normalize through `normalizeRulesFieldPath`.
   - Removed the "Matches the Personalization response shape" hint span and the "Saved as …" suffix span.
   - Renamed the `API Response Value and Corresponding Content` `<h3>` to **`Content Variations`**; **Default Content** moved directly under the `<h3>`; each static-mapping row is wrapped in a `content-variation-block` titled **`Content Variation N`** with its own **Remove** button (`btn-secondary btn-small`).
   - **Default Content** inputs render side-by-side (Content Type + Content) so they mirror the variation row layout; Content Type / Content cells span the full available width via the new `default-content-row` grid.
   - Field path peek toggle ("Display the most recent Personalization API response") shows the latest `personalizationResponse` JSON inline; when none exists, links to the Personalization API page.
   - Default radio for Content source switched to **Static**; explainer paragraph rewritten with the `cart_subtotal` / free-shipping example.

2. **Schema editor `date` type:**
   - New `'date'` `FieldType` plumbed through `client/src/types/schema.ts`, `SchemaEditor` (FieldTypeSelect option), `PayloadEditor` (`<input type="date">` that calls `showPicker()` on click + focus so the calendar opens from anywhere in the field), `schemaDefaults` (`''`), `payloadAlign` (`YYYY-MM-DD` validation/coercion), `payloadCompleteness`, and `jsonSchemaFromMock` (emits `{ type: 'string', format: 'date' }`). Server `mockEventSchema` enum updated to match.

3. **`Events v2` / `Experiences v2` sandbox tracks (full track isolation):**
   - New header tabs added to `AppHeader` (no asterisk on `Experiences v2`).
   - `client/src/store/createScopedStore.ts` exports `createScopedAppStore(persistKey)` — combines all slices once and returns a fresh store + persistor under the given localStorage key. `client/src/store/index.ts` rewires v1 to `createScopedAppStore('growthloop-poc')`; new `client/src/store/v2Store.ts` instantiates the v2 copy under `'growthloop-poc-v2'`.
   - New `client/src/scope/ScopeContext.tsx` exposes `ScopePaths` + `useScopePaths()`; `client/src/scope/V2ScopeLayout.tsx` wraps every `/v2/*` route with its own Redux Provider, PersistGate, React Query client, and `ScopePathsProvider` value. `App.tsx` registers the v2 routes (`/v2`, `/v2/events/new`, `/v2/events/:id/edit`, `/v2/content`) under that layout.
   - Hardcoded paths inside `HomePage`, `MockContentPage`, `CreateMockEventPage`, and `EditMockEventPage` were replaced with `useScopePaths()` lookups so the same components serve both tracks.

4. **Events v2 → "Content" wrapper section:**
   - `DynamicContentRulesSection` now branches on `scopeId`. v1 keeps its single `Dynamic Content Rules` `<details>` with the existing inner body. v2 wraps everything in a top-level `Content` `<details>` whose inner body is three nested collapsibles: **Page Structure**, **Static Content**, **Dynamic Content**.
   - `Page Structure` (`pageStructureSlice`, `PageStructureEditor`): 1fr/2fr grid. Left = Edit / Save / Cancel + per-row layout radios (`Full-Width` / `50-50`) + Add Another Row + Remove. Right = preview blocks via `page-structure-preview-row-*`.
   - `Static Content` (`staticContentSlice`, `StaticContentEditor`): 2fr/1fr grid with a `Collapse inputs` toggle (`inputs-collapsed` modifier expands the preview to full width). Each Page Structure row is its own `<details>` (open by default, opens automatically when Page Structure adds rows). Block Content Type is `text` or `imageUrl`; URL validity drives `static-content-invalid-hint`.

5. **Dynamic Content v2 overhaul (`eventDynamicTargetsSlice`, `DynamicContentV2Section`):** (See **Major behaviors** → Events v2 for the current shape: per-cell targets, mappings, preview grid, and later removal of Content source radios + `{{api_value}}` text interpolation.) Original build: new slice keyed by `eventId`, **+ Add target** for unoccupied slots, **Save Dynamic Content** validation (field path + image URLs), `resolvePreviewForCell` in the editor preview.

6. **Experiences v2 page (`MockContentPage` v2 branch + `MockExperienceV2Card` + `MockExperienceV2LiveRegion`):** Initial implementation: collapsible cards, summary-only Trigger, `MockExperienceV2LiveRegion` with `resolveV2Cell` and Default/Dynamic pills. Later UI iterations (refresh row in summary, light `var(--text)` canvas, removed live heading/lede) are documented under **Major behaviors** → Experiences v2.

### May 12–14, 2026 session (follow-up polish + schema)

1. **Static / Dynamic / Experiences v2 image previews:** Image URL cells fill the preview/live cell width with no inner padding; height follows aspect ratio (`:has(> img)` rules and `.static-content-preview-image` / `.mock-experience-v2-cell-image` in `index.css`).

2. **Experiences v2 layout + chrome:** Removed the **Live experience** heading and long lede from `MockExperienceV2LiveRegion`. **Refresh Experience** / **Reset to Default Experience** + “Publish succeeded…” copy moved from the live region into **`MockExperienceV2Card`**’s **`<summary>`** on a second row (`mock-experience-v2-summary-actions`) below the event title row; refresh state lifted to the card and passed into the live region as props. Simulated “page” strip uses **`background: var(--text)`** with tuned text colors for chrome vs inner cells.

3. **Dynamic Content v2:** Removed the **Content source** fieldset (Static/Flexible radios); **`{{api_value}}`** in text variation Content (`apiValueTemplate.ts`, `experienceResolveV2.ts`, editor preview). Helper copy under **Content** for text rows.

4. **Schema `timestamp` type:** New field type; read-only placeholder in `PayloadEditor`; completeness skip; `alignPayloadToMockSchema` clears to `''`; `jsonSchemaFromMock` `date-time`; **`injectTriggerTimestamps`** on client publish and Fastify publish; server **`validatePayload`** gains explicit **`date`** and **`timestamp`** checks (`server/src/lib/validatePayload.ts`, `server/src/lib/injectTriggerTimestamps.ts`).

5. **Trigger / primary button feedback:** Class **`mock-event-trigger-btn`** on Trigger (Events + Experiences v1 cards) and v2 summary **Refresh** / **Reset**; **`:active`** inverted colors tied to **`--event-accent`**. Summary primary buttons: **`appearance: none`** / **`font: inherit`** for consistent paint inside `<summary>`.

### May 17, 2026 session (Page Structure Default Display + Experiences v2 polish)

1. **Page Structure → Default Display (Show / Hide):**
   - Per-row **Default Display** dropdown in `PageStructureEditor` (alongside Full-Width / 50-50 radios).
   - **`defaultDisplay: 'show' | 'hide'`** on `PageStructureRow`; **`normalizePageStructureRow`** defaults missing/invalid values to `'show'`.
   - Exported **`PageStructureRowLayout`** (`'full' | 'half-half'`) — required for Vercel/production `tsc` after the field was referenced without a type definition.

2. **Static Content respects Hide:**
   - `StaticContentEditor` uses **`staticStructureRows`** (Show only) for editor, preview, reconcile, and save via **`reconcileForStaticEditor`** + **`isPageStructureRowVisibleForStaticContent`**.
   - All-Hide structure shows a muted hint to use Dynamic Content instead.

3. **Dynamic Content unchanged for Hide rows:**
   - `DynamicContentV2Section` still uses the **full** `structureRows` list for slot computation, targets, and preview — Hide rows remain targetable.

4. **Experiences v2 live region + Hide rows:**
   - `MockExperienceV2LiveRegion`: Hide rows **not rendered** in default view (`forceDefault`).
   - After trigger + refresh, Hide rows appear **only** when a dynamic mapping matches (`source === 'matched'`); no static fallback for those rows.

5. **Experiences v2 card expand persistence + flash fix:**
   - New **`experienceV2CardExpandSlice`** whitelisted on v2 persist; controlled `<details open={cardExpanded}>`.
   - Fixed rapid open/closed flashing on return navigation: removed **`preventDefault()`** on `toggle` and sync Redux from **`e.currentTarget.open`** instead of toggling `!cardExpanded`.

6. **Header nav:**
   - Primary tabs: **Events** / **Experiences** (v2 routes). v1 **Events v1** / **Experiences v1** links removed from header (routes still reachable by URL).

### Post–May 17, 2026 session (Dynamic Content v2 conditions, schema, operators)

1. **v2 multi-condition AND (v2 only):**
   - Removed global **Field path to target API response value** from `DynamicContentV2Section`; paths live on each condition inside each **Content Variation**.
   - `V2StaticMappingRow` now has **`conditions: { fieldPath, operator, value }[]`**; all active conditions must match. **`mappingConditions.ts`** implements AND + `resolvedValuesByPathSuffix`.
   - Legacy persisted config: global `fieldPath` + row-level operator/value migrates to a one-element `conditions` array on load.
   - Text tokens: **`{{api_value}}`** (first active condition) and **`{{api_value:segment}}`** (suffix after `data.`) via **`interpolateApiValues`** in `apiValueTemplate.ts`.
   - Save no longer strips incomplete variations; no global field-path validation on save.

2. **`customer_id` schema type:**
   - Locked key still required; type dropdown enabled with **string** or **number** only (`CUSTOMER_ID_FIELD_TYPES`, `SchemaEditor.tsx`).
   - Client + server validation updated (`mockEventSchemaRules.ts`, `server/src/types.ts`).

3. **Existence operators (v1 + v2):**
   - **Is null** / **Is not null** in `ruleMatch.ts`; example value disabled via **`ConditionOperatorValueField`**.

4. **Relative date operators (v1 + v2):**
   - **Occurred within the last** / **Did not occur within the last** with **Days** threshold; logic in **`relativeDateMatch.ts`** (`parseResolvedInstant`, `occurredWithinLastDays`).
   - Intended for ISO strings on the Personalization profile (e.g. `date_last_visit_billing`). Evaluated against **`Date.now()`** at match time.

5. **Shared threshold UI:** **`ConditionOperatorValueField.tsx`** — dynamic label/placeholder/disabled state from **`operatorThresholdKind`** (`example` | `days` | `none`).

## Build / deploy hints

- **Vercel:** Root = repo root (where `vercel.json` + `api/` + `client/` live). Preset **Other**; build/output driven by `vercel.json`. SPA rewrite excludes `/api/*`.

## Resuming work — sensible next steps

1. **Personalization request parity:** If backend-only mode should mirror the Vercel proxy’s POST body for **non–mock-event** flows, align Fastify generic GET vs POST (mock-event refresh already sends **`customerId`** from payload).
2. **Fastify Kafka body:** If using KafkaJS path, confirm record **value** matches what GrowthLoop expects (Vercel REST path sends `payload` only).
3. **`example_event_bridge`:** Ignored by git; keep a separate clone if you need the Python reference in-repo.
4. **Legacy events:** Schemas created before the **`customer_id`** rule may still exist in persisted state; editing/recreating may be needed for refresh until schema includes root **`customer_id`** (string or number). Legacy v2 dynamic config without `conditions[]` migrates on load.

## Key source files (quick index)

- Publish hook: `client/src/hooks/useMockEventPublish.ts`
- Event payloads (per event): `client/src/store/eventPayloadsSlice.ts`
- Payload completeness (Trigger gating): `client/src/lib/payloadCompleteness.ts`
- `customer_id` from aligned payload: `client/src/lib/customerIdFromPayload.ts`
- Schema rules (locked customer_id, empty-key check, initial schema): `client/src/lib/mockEventSchemaRules.ts`
- Schema types (`'date'`, **`'timestamp'`**): `client/src/types/schema.ts`
- Event name rules: `client/src/lib/eventNameRules.ts`
- Duplicate name detection: `client/src/hooks/useExistingEventNames.ts`
- Schema editor (lockable rows, hideable add button, date + timestamp types): `client/src/components/SchemaEditor.tsx`
- Number + date + timestamp payload UI: `client/src/components/PayloadEditor.tsx` (`NumberField`, `case 'date'`, `case 'timestamp'` read-only placeholder)
- Trigger-time ISO injection (client): `client/src/lib/injectTriggerTimestamps.ts`
- Trigger-time ISO injection (server): `server/src/lib/injectTriggerTimestamps.ts`
- Server payload validation (`date`, `timestamp`, nested): `server/src/lib/validatePayload.ts`
- Rules + operators (v1): `client/src/store/eventDynamicRulesSlice.ts`, `client/src/lib/ruleMatch.ts`, `client/src/lib/relativeDateMatch.ts`, `client/src/lib/experienceResolve.ts` (`forceDefault` option)
- Condition threshold UI: `client/src/components/ConditionOperatorValueField.tsx`
- v2 AND conditions: `client/src/lib/mappingConditions.ts`
- Field path `data.` helpers: `client/src/lib/personalizationFieldPath.ts`
- Panel title suffix for Experiences header: `client/src/lib/panelTitle.ts`
- Per-event card/button accents: `client/src/lib/eventTheme.ts`
- Live experience UI (v1): `client/src/components/MockExperienceLiveRegion.tsx`
- Refresh gate: `client/src/store/experienceRefreshSlice.ts`
- Personalization fetch: `client/src/lib/personalizationClient.ts` (`customerIdFromMockEvent` vs page-driven path)
- Create event page: `client/src/pages/CreateMockEventPage.tsx`
- Edit event page (warning banner, schema realignment): `client/src/pages/EditMockEventPage.tsx`
- Personalization API page (persisted response + timestamp): `client/src/pages/PersonalizationPage.tsx`
- Mock events Redux slice (`addMockEvent`, `updateMockEvent`, `removeMockEvent`): `client/src/store/mockEventsSlice.ts`
- Server mock-event validation + PATCH route: `server/src/types.ts`, `server/src/routes/mockEvents.ts`
- Demo reset: `client/src/components/DemoResetButton.tsx`
- Vercel producer: `api/publish.js`

### v2 sandbox-track files (Events v2 / Experiences v2)

- Scoped store factory + scope context: `client/src/store/createScopedStore.ts`, `client/src/store/v2Store.ts`, `client/src/scope/ScopeContext.tsx`, `client/src/scope/V2ScopeLayout.tsx`
- Page Structure (`defaultDisplay`, layout types, static visibility helper): `client/src/store/pageStructureSlice.ts`, `client/src/components/PageStructureEditor.tsx`
- Experiences v2 card expand (persisted): `client/src/store/experienceV2CardExpandSlice.ts`
- Static Content: `client/src/store/staticContentSlice.ts`, `client/src/components/StaticContentEditor.tsx`
- Dynamic Content v2 slice + editor: `client/src/store/eventDynamicTargetsSlice.ts`, `client/src/components/DynamicContentV2Section.tsx` (per-condition paths; no global `fieldPath` at runtime)
- `{{api_value}}` / `{{api_value:path}}` templates: `client/src/lib/apiValueTemplate.ts`
- Dynamic content rules section (v1/v2 branch): `client/src/components/DynamicContentRulesSection.tsx`
- Experiences v2 card + live region + resolver: `client/src/components/MockExperienceV2Card.tsx`, `client/src/components/MockExperienceV2LiveRegion.tsx`, `client/src/lib/experienceResolveV2.ts`
- Experiences page (v1/v2 branch): `client/src/pages/MockContentPage.tsx`
- Shared layout / accents / button press / image cells (includes v2 summary, `mock-event-trigger-btn`, live region canvas, `:has` image rules): `client/src/index.css`

---

*Last aligned with implementation in this workspace as of **May 19, 2026**: prior **May 17** work (Page Structure Show/Hide, Experiences v2 polish, header nav); plus **post–May 17** — v2 **multi-condition AND** (per-condition `data.*` paths, `{{api_value:suffix}}`), **`customer_id`** type **string | number**, operators **Is null** / **Is not null** / **Occurred within the last** / **Did not occur within the last** (days), **`ConditionOperatorValueField`**, **`mappingConditions.ts`**, **`relativeDateMatch.ts`**, and v2 live resolution against full profile data in **`MockExperienceV2LiveRegion` / `resolveV2Cell`**.*
