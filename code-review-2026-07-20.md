# ABCFinancialAI Code Review — 2026-07-20

**Reviewer:** Claude
**Date:** 2026-07-20
**Scope:** Full project — `https://github.com/mstaal1974/ABCFinancialAI-` (local clone at repo root)
**HEAD commit:** `b34f709` (branch `claude/login-counts-different-computers-7we02e`)
**Build status:** `npm run build` (vite) — ✅ succeeds (single 996 KB / 281 KB gzip chunk). `npx tsc --noEmit -p tsconfig.app.json` — ❌ **fails with 1,379 errors**. The build script does **not** run `tsc`, so type errors never gate anything. `npm audit` — 9 vulnerabilities (6 high, 1 moderate, 2 low), all dev/build-time deps.
**Prior reviews consulted:** None — this is the first review.

---

## Executive Summary

ABCFinancialAI (product name **"EduGrowth BI"**) is a single-page React 19 + TypeScript + Vite financial-intelligence dashboard for an Australian education/training business. It is, structurally, **one 10,839-line `src/App.tsx` file** plus a one-function serverless Gemini proxy (`api/gemini.js`), two SQL files (`db/`), and stock Vite scaffolding. The browser talks **directly to Supabase** (REST + Auth) using the public anon key and a per-user JWT. There is no application server enforcing anything — which means **Postgres Row-Level Security is the entire authorisation model**, and that model is where this review's most serious findings concentrate.

**The authorisation model is effectively absent.** Every RLS policy present in the repo (`scenarios`, `enrolment_plans`, `xero_actuals`) is `for all to authenticated using (true) with check (true)` — i.e. any logged-in user can read, overwrite, and delete **every** row, including rows belonging to other users. `sbGet` fetches `select=*` with no user or tenant filter anywhere in the codebase. The core financial tables (`unit_adjustments`, `coa_adjustments`, `hiring_plan`, `people_overrides`, `audit_log`) have **no schema or policy file in the repository at all** — their production RLS is unversioned and unauditable, and the established pattern strongly suggests the same blanket policy. The practical result is that all financial data — unit economics, the chart-of-accounts overrides, the hiring plan, **individual staff salaries**, and uploaded Xero actuals — is a single shared global dataset that every authenticated user can read and mutate. This is also the direct root cause of the customer's reported "different logins see different numbers" symptom: `xero_actuals` is a single shared row that one user's upload silently overwrites for everyone, layered over per-browser `localStorage` caches that race against it.

**Secrets have leaked and require rotation, not just removal.** The initial commit tracked a real `.env` containing a live `VITE_GEMINI_API_KEY` and the Supabase anon JWT; the key was changed and re-committed twice more before `.env` was finally untracked in `f957d2c`. Because the key is `VITE_`-prefixed it was also baked into every deployed browser bundle. It is permanently in git history and in shipped bundles and **must be rotated**. The Gemini proxy that now fronts the key (`api/gemini.js`) has **no authentication and no rate limiting** — it is an open, unmetered relay to a paid LLM API on the public domain.

**The audit trail is not defensible.** Audit rows are constructed entirely client-side — client-chosen `id`, client-supplied `user_email`/`user_name`, and a client-supplied `created_at` — and written through the same blanket-RLS table, so any authenticated user can forge entries attributed to someone else, overwrite existing entries, or delete them. Worse, the point-in-time "restore" feature reconstructs financial state by trusting `old_value`/`detail` from these forgeable rows, turning a tampered log into an active data-corruption vector. For a system handling financial records under ASQA/APP expectations, this is a material gap.

**Financial correctness has real defects, not just theoretical ones.** The "budget" a variance is measured against is literally `revenue * 0.95` (self-referential — it structurally reports ≈+5% favourable and measures nothing). Headline revenue is actuals-aware while the per-region breakdown is modeled, so the region table does not reconcile to the headline. The core staff-cost formula (with hardcoded 12% super / 5.5% payroll tax) is duplicated in ~12 places, and the two "source of truth" salary tables disagree (Sales $90k vs $100k; Admin $68k vs $67.5k), so hiring deltas are costed on a different basis than the baseline they modify. Loan **principal** outflows are filed under "Overheads" and flow into operating payments and the break-even analyser. `parseDate` silently falls back to *today* on any parse failure, making period bucketing non-deterministic. None of this is tested.

**TypeScript safety is a fiction.** `tsc` reports 1,379 errors (597 implicit-`any` parameters alone), and nothing in the build or any CI runs it — the app ships regardless. There are no tests, no CI, no build gate, no error tracking, no security headers, and no deployment config in the repo. Monetary values are bare floating-point `number`s throughout.

**What is genuinely sound:** authentication itself is delegated to Supabase Auth (bcrypt, token refresh, an enumeration-safe password-reset flow) rather than hand-rolled; the anon key is public *by design* (the exposure that matters is the Gemini key and the weak RLS behind the anon key, not the anon key itself); the `data` memoisation dependency array is correct; and the codebase is heavily and clearly commented. The bones of the domain model are thoughtful. But the trust boundary is drawn in the wrong place — almost everything that matters is enforced only in the browser or in `using(true)` policies — and until the RLS/authorisation model and the secret rotation are addressed, the security posture should be treated as **pre-production**, regardless of the fact that it is already deployed.

**Highest-priority actions:** (1) rotate the Gemini key; (2) replace every `using(true)` policy with real ownership/tenant scoping and bring all table schemas into version control; (3) put auth + rate limiting on the Gemini proxy; (4) make the audit log server-attributed and append-only; (5) fix the self-referential budget and the divergent salary/revenue sources. Everything else follows these.

---

## Section 0: Ground Truth — Actual Repository Structure

**Commands run:** `git rev-parse --short HEAD`, `git log --oneline -30`, full `find` inventory, `wc -l`, `cat package.json/.env.example/.gitignore`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, `npm audit`, `npm outdated`, git-history secret scan.

**File inventory (excl. `node_modules/`, `dist/`, `.git/`):**

```
.env.example        api/gemini.js          db/scenarios.sql       src/App.tsx (10,839)
.gitignore          eslint.config.js       db/xero_actuals.sql    src/App.css (184)
README.md           index.html             public/favicon.svg     src/index.css (0, empty)
package.json        vite.config.ts         public/icons.svg       src/main.tsx (10)
package-lock.json   tsconfig*.json (×3)    src/assets/{hero.png,react.svg,vite.svg}
```

**Line counts (code):** `src/App.tsx` 10,839 · `db/scenarios.sql` 48 · `db/xero_actuals.sql` 29 · `eslint.config.js` 23 · `api/gemini.js` 15 · `src/main.tsx` 10 · `vite.config.ts` 7 · `src/index.css` 0. **Total ~11,155 lines; 97% of it is one file.**

**Real module map (built from disk):**

| Area | Reality |
|------|---------|
| **`api/`** | One file, `api/gemini.js` — a **Vercel serverless function** (default export `handler(req,res)`) proxying POSTs to Google Gemini `gemini-2.5-flash` using `process.env.GEMINI_API_KEY`. No auth, no rate limit, no CORS handling, no input validation. This is the *entire* server-side surface. |
| **`db/`** | Two hand-written Postgres/Supabase SQL files: `scenarios.sql` (tables `scenarios`, `enrolment_plans`) and `xero_actuals.sql` (table `xero_actuals`). Both enable RLS with `using(true) with check(true)`. **No migration tooling, no applied-state tracking.** The 5 core tables the app reads/writes are **not represented here at all.** |
| **`.env.example`** | Declares `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`. Does **not** declare `GEMINI_API_KEY` — which is the variable `api/gemini.js` actually consumes. Contract is both incomplete and misleading (documents a client-leaky var; omits the server var). |
| **`src/`** | Entry `main.tsx` → `App.tsx`. **No router** (tabbed SPA via `activeTab` string state). State: ~40 `useState` hooks in the top-level `App`, prop-drilling + module globals (`_authToken`). API-client layer: `sbGet/sbUpsert/sbDelete/sbAudit` (lines 133–177) + auth helpers (60–130). One giant file; ~25 feature components inline. |
| **`index.html`** | Loads **Tailwind from `cdn.tailwindcss.com` (the dev CDN)** and **SheetJS/xlsx from `cdn.sheetjs.com`**, both without SRI. Title "EduGrowth BI". |
| **Third-party services** | Supabase (auth + Postgres REST), Google Gemini (`gemini-2.5-flash`), a dead direct-to-Anthropic call. Hosting inferred as **Vercel** (the `api/` convention + `IS_PROD` proxy switch); **no `vercel.json` in repo.** |

**Diff against the instructions' tier map:** The map is essentially accurate. Corrections to fold in: (a) `api/` is a *single* Vercel function, not a general server; (b) `db/` covers only 3 of 8 tables — the 5 highest-value tables are unversioned; (c) `.env.example` is missing `GEMINI_API_KEY`; (d) hosting is Vercel but undeclared in-repo; (e) `public/icons.svg` exists (not noted); (f) there is no router. Note also: **HEAD is a working feature branch, not `main`** — `git pull` was not run (it would disrupt an in-progress branch); findings are against `b34f709`.

---

## Section 1: Project Minimum File Audit

| Item | Present | Notes |
|------|---------|-------|
| README.md (product-specific) | ✗ | Present but is the **stock Vite React+TS template** — documents the template, not the product. |
| TODO.md | ✗ | Absent. |
| .env.example (complete) | ⚠️ | Present but **incomplete/misleading**: omits `GEMINI_API_KEY` (used by `api/gemini.js`); documents `VITE_GEMINI_API_KEY` which is client-exposed. |
| Tests / CI | ✗ | No test files, no runner config, no `.github/workflows/`. Nothing gates PRs. |
| LICENSE | ✗ | Absent. |

`.gitignore` correctly covers `.env`, `.env.*` (keeping `.env.example`), `node_modules`, `dist`, editor dirs, logs. **However, git history still contains a previously-committed real `.env`** (see #4). `dist/` is not tracked (good). `package.json` `name` is still `vite-react-typescript-starter`, `version` `0.0.0`.

**Summary:** Four of five minimum artefacts missing or unfit. Highest-priority gaps: a real README (env reference + which vars are public vs secret is a security artefact here), a test harness, and completing/correcting `.env.example`.

---

## Section 2: Security

Priority key: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

### 2a. Client-Side Secret Exposure

**[TIER 1] git history + shipped bundle — Real Gemini API key committed and baked into public bundles**
Severity: 🔴 Critical
Location: git history — `3dd6f1f` (initial), `20aaa52`, `23b7b5c` (changed the key), removed in `f957d2c`; `.env.example` still lists `VITE_GEMINI_API_KEY`.
Description: The initial commit tracked a real `.env` with `VITE_SUPABASE_URL=https://juygejpmyujvahsxnrxa.supabase.co`, the Supabase anon JWT, and a **real `VITE_GEMINI_API_KEY`**. The key value was changed twice and re-committed. Because it is `VITE_`-prefixed, Vite **inlined it into every production bundle** it was built with — it was public to every user who ever loaded the app, and it remains in git history permanently. Removing `.env` from tracking (`f957d2c`) does not un-leak it. (The Supabase *anon* key is public **by design** and is not itself the vulnerability — but see 2c: its safety depends entirely on RLS, which is broken.)
Recommendation: **Rotate the Gemini API key now** (revoke the exposed one). Serve Gemini only through the server proxy using the unprefixed `GEMINI_API_KEY`. Consider history scrubbing (BFG/`git filter-repo`) for hygiene, but rotation is the control that matters. Add secret scanning (e.g. gitleaks) to prevent recurrence.
Status: New

**[TIER 2] src/App.tsx:4768, 5675 — `VITE_GEMINI_API_KEY` interpolated into a client-side URL on the dev/StackBlitz path**
Severity: 🟠 High
Location: `src/App.tsx:4766-4768`, `5673-5675`.
Description: `GEMINI_BASE`/`GEMINI_URL` use the server proxy only when `IS_PROD` (hostname not localhost/stackblitz/webcontainer). On any non-prod build the code calls `generativelanguage.googleapis.com/...?key=${import.meta.env.VITE_GEMINI_API_KEY}` directly — putting the key in the bundle, the URL, browser history, and network logs. The `IS_PROD` hostname heuristic is also fragile (a preview/staging domain or a renamed host silently falls back to the exposed path).
Recommendation: Delete the direct-call branch entirely; always call `/api/gemini`. Remove `VITE_GEMINI_API_KEY` from `.env.example`. Run the proxy locally for dev.
Status: New

**[TIER 2] src/App.tsx:4139 — Dead direct-to-Anthropic call from the browser (broken + wrong pattern)**
Severity: 🟡 Medium
Location: `src/App.tsx:4139-4148` (`CodeAuditAgent`).
Description: `fetch("https://api.anthropic.com/v1/messages", …)` is issued from the browser with a hardcoded model (`claude-sonnet-4-20250514`), **no API key, no `anthropic-version` header, and no CORS opt-in** — so it always fails (CORS/401) and the feature is non-functional. It also demonstrates the same client-side-LLM anti-pattern; if a key were ever added here it would be exposed.
Recommendation: Either remove `CodeAuditAgent` or route it through a server proxy with auth. Do not add a key to this call site.
Status: New

### 2b. Authentication & Authorisation

**Endpoint / data-access guard table** (there are no app routes; the "surface" is the Supabase data helpers and their guard is RLS):

| Path | Method | Auth required | Guard implementation | Verdict |
|------|--------|---------------|----------------------|---------|
| `sbGet(table)` → `GET /rest/v1/{table}?select=*` | GET | JWT (or anon fallback) | **RLS only**; no code-side scope | 🔴 reads all rows |
| `sbUpsert(table,rows)` → `POST /rest/v1/{table}` | POST | JWT | **RLS only**; merge on client key | 🔴 writes any row |
| `sbDelete(table,match)` → `DELETE /rest/v1/{table}` | DELETE | JWT | **RLS only**; client-supplied match | 🔴 deletes any row |
| `api/gemini.js` `/api/gemini` | POST | **None** | none | 🔴 open proxy |
| Supabase `/auth/v1/*` (login/refresh/recover/user) | POST/PUT | n/a | Supabase Auth | ✅ delegated |

**[TIER 1] src/App.tsx — No authorisation/role model; destructive operations reachable by any authenticated user**
Severity: 🔴 Critical
Location: no role checks anywhere; `handleReset` `10754-10764`, `RestorePanel` `4342-4466`, Xero clear/upload `10529-10543`.
Description: There is no admin/role concept used for access control — every "role" in the code is a staffing/domain concept or an LLM message role. No mutating action is gated by privilege. Any logged-in user can "Reset all data", run a point-in-time restore that mass-rewrites `unit_adjustments` for the whole org, or overwrite the shared Xero actuals. Combined with 2c, possession of *any* account is full read/write/destroy over all financial data.
Recommendation: Introduce a real role model (a `profiles`/`user_roles` table keyed by `auth.uid()`, checked in RLS `USING`/`WITH CHECK`), and gate destructive/admin operations behind it both in the DB policy and the UI.
Status: New

**[TIER 2] src/App.tsx:79-84 — Session incl. refresh token stored in `sessionStorage`**
Severity: 🟠 High
Location: `src/App.tsx:79-84`; module global `_authToken` at `61`.
Description: `access_token`, the long-lived `refresh_token`, and the full `user` object are placed in `sessionStorage`. Any XSS (and the app has an active DOM-injection XSS vector, see 2d) can exfiltrate the refresh token and mint access tokens indefinitely.
Recommendation: Prefer Supabase's httpOnly-cookie session strategy, or at minimum stop persisting the refresh token in web storage. Fix the XSS in 2d regardless.
Status: New

**[TIER 1] src/App.tsx:88-96 — Logout does not reliably revoke the refresh token**
Severity: 🟡 Medium
Location: `src/App.tsx:88-96`.
Description: `sbSignOut` wraps the `/auth/v1/logout` call in `try/catch {}` and clears local state unconditionally. If the network call fails or is blocked, the refresh token remains valid server-side while the user believes they have logged out.
Recommendation: Await logout success; on failure surface an error and/or retry; consider global sign-out (`?scope=global`).
Status: New

**[TIER 1] src/App.tsx:98-105, 3236 — `must_change_password` gate is client-side and self-clearable**
Severity: 🟡 Medium
Location: decision at `src/App.tsx:3236, 10278-10280`; `sbUpdatePassword` writes `must_change_password:false` into user-writable `user_metadata` at `102`.
Description: The forced-password-change flag lives in Supabase `user_metadata`, which the user can write via `/auth/v1/user`. A client can clear its own flag or simply ignore the gate (it is UX, not enforcement). Never base a privilege decision on `user_metadata`.
Recommendation: Track forced-change server-side (a column the user cannot self-update, enforced by policy/trigger), or accept it as pure UX and document that.
Status: New

**[TIER 2] src/App.tsx:76, 3238 — Login errors enable user/account-state enumeration; no client rate limiting**
Severity: 🟡 Medium
Location: `src/App.tsx:76` (error text), `3238-3239` (surfaced verbatim). Contrast `handleForgot` `3244-3256` which is enumeration-safe.
Description: Login surfaces the raw Supabase error, which distinguishes "Invalid login credentials" from "Email not confirmed"/rate-limit, allowing account enumeration. There is no client-side throttling on repeated attempts.
Recommendation: Show a single generic "invalid email or password" message. Rely on Supabase Auth rate limits and consider a captcha on repeated failures.
Status: New

### 2c. Database Security & Row-Level Security

**[TIER 1] db/scenarios.sql, db/xero_actuals.sql — `using(true) with check(true)`: global read/write/delete for every authenticated user**
Severity: 🔴 Critical
Location: `db/scenarios.sql:21-27` (scenarios), `42-48` (enrolment_plans); `db/xero_actuals.sql:23-29` (xero_actuals — added in HEAD `b34f709`, mirroring the pre-existing pattern).
Description: `for all to authenticated using (true) with check (true)` grants every logged-in user SELECT/UPDATE/DELETE on **all rows**, including rows stamped with another user's `user_email`. That column is decorative — nothing filters on it. `xero_actuals` is a single shared `id='shared'` row, so one user's Xero upload overwrites the company-wide actuals that drive everyone's revenue/cashflow.
Recommendation: Replace with ownership- or tenant-scoped policies (`using (user_email = auth.jwt()->>'email')` or an org model), separate read vs write policies, and set owner columns server-side (default `auth.uid()`), never from the client body.
Status: New

**[TIER 1] db/ — Core financial tables have no versioned schema or RLS in the repo**
Severity: 🔴 Critical
Location: `unit_adjustments`, `coa_adjustments`, `hiring_plan`, `people_overrides`, `audit_log` are used at `src/App.tsx:133-177, 4358, 10293-10636` etc.; no SQL file defines them.
Description: The five most sensitive tables (including per-person salary data in `people_overrides` and the audit trail) have their schema and RLS defined only in the live Supabase project, outside version control — unauditable and un-reviewable. Given the two committed files, the likely production state is the same blanket policy or RLS disabled.
Recommendation: Export the full schema + RLS for all tables into `db/` as tracked migrations; review each policy line-by-line; confirm RLS is *enabled* (a policy on a table without RLS enabled does nothing).
Status: New

**[TIER 1] src/App.tsx:133-160 — `select=*` with zero scoping → one shared global dataset (root cause of "different logins, different numbers")**
Severity: 🔴 Critical
Location: `src/App.tsx:133-138` (`sbGet`), `141-152` (`sbUpsert`), `154-160` (`sbDelete`).
Description: No query anywhere filters by user or tenant. All financial data is a single shared pool every authenticated user reads and overwrites. This is the mechanism behind the reported symptom: the shared `xero_actuals` row plus per-browser `localStorage` caches (`10294-10298`) mean whoever uploaded last — and whatever stale cache each browser holds — determines the numbers shown.
Recommendation: Decide the intended data model (single-org-shared vs per-user). If shared is intended, that is a *product* decision that must be stated and the localStorage caching reconciled to it; if per-user, add scoping in both RLS and queries. Either way, remove the localStorage/DB race.
Status: New — closely related to the customer's open "login counts" issue.

**[TIER 1] db/ + data model — No monetary types or constraints; financial values live in untyped JSON/text**
Severity: 🟠 High
Location: `db/*.sql` store `data text`; adjustment values are serialized JSON (`src/App.tsx:10429` `{key, value}`); no `numeric`/`decimal` columns, no CHECK/NOT NULL/FK constraints on amounts.
Description: Financial amounts are never given a database type; they are JSON blobs written from the client as JS floats. There are no constraints preventing `NaN`, negative, or malformed values (`Number(ov)` can yield `NaN`, `4384`). Corrupt financial data is silently storable.
Recommendation: Model financial data in typed columns (`numeric`, or integer minor units) with CHECK constraints, or at minimum validate shape/range at write time (see 2d).
Status: New

### 2d. Input Validation & Injection

**[TIER 2] src/App.tsx:5855-5872 — XSS via `dangerouslySetInnerHTML` on AI/markdown output**
Severity: 🟠 High
Location: `src/App.tsx:5862, 5865, 5868, 5871` (`GeminiAssistant.renderText`). Note the *other* markdown renderer at `5343-5352` (`MonthlyNarrativePanel`) is safe (JSX text nodes) — the inconsistency is itself a smell.
Description: Gemini output (and the `Connection error: ${e.message}` string) is rendered as raw HTML with no sanitisation. LLM output is untrusted; a prompt-injection or crafted shared-data value (unit names, Xero filenames entered by other users flow into the prompt context, `5751-5802`) that induces `<img src=x onerror=…>` executes in the victim's session. With shared data across users, this is a stored-XSS path, not just self-XSS.
Recommendation: Render as text, or sanitise with DOMPurify and an allowlist. Reuse the safe renderer at `5343`.
Status: New

**[TIER 1] src/App.tsx:141-146 — No schema validation and mass-assignment at the write boundary**
Severity: 🟠 High
Location: `src/App.tsx:141-146` (`sbUpsert`); writes at `8958, 9627, 10542` set `user_email`/`id` from the client.
Description: There is no Zod/Valibot validation before writing to Supabase. Objects (incl. `data: JSON.stringify(payload)`, `user_email`, `id`) are serialized straight through. A client can set any `user_email`/`id`, impersonating another user's rows (compounded by `using(true)`), and can write arbitrary shapes into salary/financial fields.
Recommendation: Validate every write with a schema at the boundary; set owner/id columns server-side (DB default from `auth.uid()`); never trust client-supplied identity columns.
Status: New

### 2e. AI/LLM Security

**[TIER 1] api/gemini.js — Open, unauthenticated, unmetered LLM proxy**
Severity: 🟠 High
Location: `api/gemini.js:1-15`.
Description: The proxy checks only that the method is POST, then forwards the body to Gemini with the server key. No authentication, no rate limiting, no per-user quota, no CORS restriction, no input size cap. Anyone who knows the deployed URL can send unlimited requests on the customer's Gemini bill, and use it as an open relay.
Recommendation: Require a valid Supabase JWT (verify server-side), add per-user rate limiting and a spend cap, restrict request size, and restrict CORS to the app origin.
Status: New

**[TIER 2] src/App.tsx — No prompt-injection hardening; untrusted shared data reaches prompts that drive displayed figures**
Severity: 🟡 Medium
Location: prompt assembly `src/App.tsx:5697-5802`, `4770-4783`, `4126-4147`.
Description: User/shared-supplied text (chat input, unit names, Xero filenames, COA notes) is concatenated into prompts with no delimiting or untrusted-content marking, and outputs are surfaced as recommendations/verdicts. There is no system-prompt hardening against instruction override.
Recommendation: Delimit and label untrusted content; harden the system prompt; treat outputs as advisory and validate before display.
Status: New

**[TIER 2] src/App.tsx — Financial data + user identity sent to Gemini; no consent/minimisation (APP 8 cross-border)**
Severity: 🟡 Medium
Location: `src/App.tsx:5751-5829`, `4770-4783`.
Description: Revenue, expenses, top expense accounts, staffing/salary-derived figures and the current user's email are transmitted to Google Gemini. There is no consent gate, no data minimisation, and no statement of where processing occurs. For Australian personal/financial information this is an APP 6/APP 8 exposure. *(Risk flag for the customer's own legal advice, not a legal determination.)*
Recommendation: Minimise what is sent (aggregate, drop identifiers), add a consent/disclosure point, and document the provider, region, and retention. Confirm no PII is needed for the feature to function.
Status: New

**[TIER 2] src/App.tsx:1759-1801 — AI-generated and computed figures are visually indistinguishable**
Severity: 🟡 Medium
Location: `src/App.tsx:1759-1801` (deterministic `computeRoiNumbers` outputs shown under a "Gemini · instant payback" badge).
Description: Hard computed numbers (break-even month, FY26 net, 18-mo net) are rendered inside a panel branded as AI/Gemini output, next to AI prose. Users cannot tell source-of-truth figures from model output — a trust and correctness risk in a financial tool.
Recommendation: Label calculated cards "Calculated"; confine the AI badge to prose. (Cross-ref 9a-M6.)
Status: New

**[TIER 2] — No AI audit log or spend monitoring**
Severity: 🟡 Medium
Location: `api/gemini.js`, all call sites.
Description: There is no record (input hash, model, output, user, timestamp) of AI calls and no visible spend monitoring. For a financial product, AI decisions should be reconstructable and cost observable.
Recommendation: Log AI calls server-side (minimised) and surface Gemini spend to an operator.
Status: New

### 2f. Secrets & Credential Exposure

**[TIER 2] src/App.tsx — PII / financial data / AI output written to `console.log` in shipped code**
Severity: 🟡 Medium
Location: `3233` (full user object incl. email), `3235` (metadata), `5838` (AI output), `595` (staffing deltas, hot path), `10385`/`10393` (wage/CPI values).
Description: The production bundle logs the authenticated user object on every login and financial/AI data during normal use. This lands in browser consoles and any error-capture tooling.
Recommendation: Strip these logs (or gate behind a dev flag); never log identity, tokens, or financial values.
Status: New

*(Primary secret-exposure finding is #4 in 2a. `grep` for hardcoded `sk-`/`AIza`/`service_role`/private keys across tracked non-lockfile files found none in the current tree — the exposure is in history and via the `VITE_` bundle path.)*

### 2g. API & Transport Security Surface

**[TIER 2] — No rate limiting anywhere**
Severity: 🟠 High
Location: `api/gemini.js`; login (Supabase-side only).
Description: Neither the proxy nor any app path enforces rate limiting. Vercel/Supabase provide little by default. Credential stuffing (login) and cost abuse (proxy) are unmitigated.
Recommendation: Add rate limiting at the proxy (per-IP and per-user) and rely on/tune Supabase Auth limits.
Status: New

**[TIER 2] repo — No security headers / CSP / HSTS; no deployment config**
Severity: 🟡 Medium
Location: no `vercel.json`/`netlify.toml`; `index.html` has no CSP meta.
Description: There is nowhere in the repo setting `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. The app is thus clickjackable and has no CSP to blunt the 2d XSS. (CSP is harder given the CDN scripts and inline styles — assess honestly, but at least `X-Frame-Options`, `X-Content-Type-Options`, HSTS, and `Referrer-Policy` are free wins.)
Recommendation: Add a `vercel.json` `headers` block; work toward a CSP after removing CDN scripts (see 2i/#40).
Status: New

**[TIER 2] src/App.tsx:46-58 — Error helper reflects server response text to the client**
Severity: 🟢 Low
Location: `readJson` `46-58`.
Description: On non-JSON responses the first 120 chars of the upstream body are surfaced in the thrown error. Minor internal-detail leakage.
Recommendation: Log the detail; show the user a generic message.
Status: New

### 2h. Session, Privacy & Data Handling

**[TIER 1] src/App.tsx:163-177, 4396-4404 — Audit log is client-attributed, forgeable, deletable, and not append-only**
Severity: 🟠 High
Location: `sbAudit` `163-177` (client `id`/`user_email`/`user_name`/`created_at`); `RestorePanel.mkAuditRow` `4396-4404`; restore consumes it at `4358-4372`.
Description: Every audit field is client-supplied and written through the blanket-RLS `audit_log` table. Any authenticated user can forge entries under another `user_email`, overwrite entries (upsert merges on client `id`), or delete them. The restore feature then trusts `old_value`/`detail` from these rows to rewrite `unit_adjustments` — so a tampered log actively corrupts financial state. This is not a defensible financial audit trail.
Recommendation: Make `audit_log` INSERT-only via RLS; set `actor` from `auth.uid()` and `created_at` from `default now()` server-side; ignore client identity/timestamps; consider hash-chaining. Do not reconstruct financial state from mutable audit rows.
Status: New

**[TIER 1] — Staff salaries and user identity readable/writable org-wide**
Severity: 🟠 High
Location: `people_overrides` (`src/App.tsx:10599-10636`), audit emails/names (`167-168`), `BUDGET_INPUTS` salaries (`232-239`).
Description: Under 2c, every authenticated user can read (and alter) individual staff salary/allowance data and all identity in the audit log — an APP 6/APP 11 exposure.
Recommendation: Scope access by role/ownership (2b/2c); restrict salary data to authorised roles.
Status: New

**[TIER 2] src/App.tsx — Financial PII persisted unencrypted in `localStorage`, surviving logout; no export/delete path**
Severity: 🟡 Medium
Location: 13 keys incl. `people_overrides`, `coa_adjustments`, `applied_wage_settings`, `xero_actuals` (`10339-10413`, `5453`, `3476`); logout clears only `sb_session` (`95`); no APP 12/13 export or subject-scoped delete flow exists.
Description: Salary and financial data are cached in `localStorage` in clear text and remain after logout (readable by any origin script / next user on a shared machine). There is no data-subject export or deletion path; "Reset all data" is org-wide and does not touch `audit_log`.
Recommendation: Clear financial `localStorage` on logout; add export and subject-scoped deletion; document a retention policy. *(Risk flags for the customer's own legal advice.)*
Status: New

### 2i. Dependency Security

**[TIER 2] package-lock — `npm audit`: 9 vulnerabilities (6 high), all dev/build-time**
Severity: 🟡 Medium
Location: `vite` (7.3.1 — path traversal / arbitrary file read / `fs.deny` bypass, dev-server only), `postcss` (<8.5.10 XSS in stringify, build-time), `picomatch` (ReDoS), `esbuild`/`launch-editor` transitive.
Description: All advisories are in build/dev tooling, not the shipped runtime, so real-world exposure for the static production bundle is limited — but the dev server path-traversal issues matter for anyone running `vite dev`. `npm audit fix` resolves them.
Recommendation: Run `npm audit fix`; bump `vite`/`postcss`. Re-verify build.
Status: New

**[TIER 2] index.html — Tailwind (dev CDN) and SheetJS loaded from CDNs without SRI**
Severity: 🟡 Medium
Location: `index.html` (`cdn.tailwindcss.com`, `cdn.sheetjs.com`).
Description: `cdn.tailwindcss.com` is the **development** CDN (not intended for production — it ships an unpurged JIT compiler and is a runtime third-party dependency). Neither script has SRI, so a CDN compromise executes arbitrary JS in the app; if the CDN is unreachable the app breaks (Tailwind) or Xero upload breaks (SheetJS).
Recommendation: Install Tailwind as a build dependency (it is already in `devDependencies`) and remove the CDN; bundle SheetJS via npm; if any CDN remains, pin with SRI.
Status: New

---

## Section 3: Performance & Correctness Under Load

### 3a. Data Access Performance

**[TIER 2] src/App.tsx:10289-10458 — Login data load is a 5-request serial waterfall**
Severity: 🟡 Medium
Location: sequential `await sbGet(...)` at `10293, 10332, 10361, 10372, 10405`.
Description: Five independent reads are awaited one after another on every login, serialising latency.
Recommendation: `Promise.all` the independent reads.
Status: New

**[TIER 2] — No pagination; growth-prone tables fetched whole**
Severity: 🟡 Medium
Location: audit log `?...&limit=500` then client filter (`4578, 4705`); other `select=*` reads unbounded.
Description: Lists fetch everything (audit capped at 500 server-side but rendered unvirtualised); `unit_adjustments`/`coa_adjustments`/etc. grow without limits or pagination.
Recommendation: Paginate list reads; add `.limit()` and server-side filtering; index the columns used for ordering/filtering.
Status: New

### 3b. API / Server Performance

The only server code is the thin Gemini proxy. It awaits Gemini inline (fine for a single upstream call) but has **no timeout, retry, or circuit breaker** — a hung Gemini call hangs the function until the platform timeout. Severity: 🟢 Low (single-call function). Recommendation: add an `AbortController` timeout and a bounded retry.

### 3c. Frontend Performance

**[TIER 2] — 996 KB single bundle; no code-splitting or lazy loading**
Severity: 🟠 High
Location: whole `src/App.tsx`; build output `dist/assets/index-*.js` 996 KB (281 KB gzip); no `React.lazy`/`import()`.
Description: All ~25 tab components and `recharts` load up front in one chunk gated only by `activeTab === …`. Largest split candidates: `ScenarioLab`+`CoverageAnalyser` (`8695-9506`), `StaffPlanner` (`1368-2097`), `StaffingView` (`6006-6674`), `EnrolmentPlanner` (`9577-10118`), `ExpensesView`, `BudgetActualsPnLView`, `GeminiAssistant`, `CodeAuditAgent`.
Recommendation: Extract tab components to files and `React.lazy` them behind `Suspense`; lazy-load `recharts`.
Status: New

**[TIER 2] src/App.tsx:10790-10807 — Whole-app re-render on every state change (unmemoised props/callbacks, no `React.memo`)**
Severity: 🟡 Medium
Location: `props`/`wageProps`/`cpiProps`/`scenarioBase` object literals `10790-10794`; inline `onShowAnomalies` `10807`; children not memoised.
Description: Fresh prop-object and callback references each render, spread into unmemoised children, so any edit re-renders all mounted tabs. `data`'s own `useMemo` deps (`10463`) are correct — the cost is structural fan-out.
Recommendation: `useMemo`/`useCallback` the prop bundles and callbacks; `React.memo` tab components; longer-term, split `data` into per-domain slices/selectors.
Status: New

**[TIER 2] src/App.tsx:4914 — `useEffect(() => runScan(), [])` stale closure**
Severity: 🟡 Medium
Location: `4914`; `runScan` deps `[coaAdjustments, xeroActuals]` at `4912`.
Description: The effect captures the initial (empty) `coaAdjustments`/`xeroActuals` and never re-runs when data loads — the anomaly scan runs against stale inputs.
Recommendation: Depend on `[runScan]` (the session cache already prevents rescans).
Status: New

**[TIER 2] — Index-as-key on dynamic lists; no virtualisation; fetches without abort**
Severity: 🟢 Low
Location: `key={i}` at `4705` (audit), `5936` (chat, unbounded), `8299`, `5067/5094/5118`, `9474/10097/10105`, `3196`; fetches without `AbortController` at `4573-4587`, anomaly/Gemini/forecast effects.
Description: Index keys break on insert/delete and defeat reconciliation; growing tables (audit, P&L, chat) are unvirtualised; unmounting mid-fetch sets state on unmounted components.
Recommendation: Use stable ids as keys; virtualise the audit log and P&L table; add `AbortController` cleanup.
Status: New

---

## Section 4: Code Health & Cleanliness

### 4a. TypeScript Rigour

**[TIER 2] — `tsc` fails with 1,379 errors and never runs in the build; strict typing is a fiction**
Severity: 🟠 High
Location: `npx tsc --noEmit -p tsconfig.app.json` → 1,379 errors (597 `TS7006` implicit-any params, 254 `TS2339` prop-not-exist, 178 `TS7053` implicit-any index, 124 `TS7031` implicit-any binding, 49 unused). `package.json` `build` is `vite build` only.
Description: Despite `tsconfig.app.json` `strict:true`, essentially no function in `App.tsx` is typed, and nothing type-checks in the build or CI, so the app ships regardless of type errors. `tsconfig.json` (root) contradicts it with `strict:false, allowJs:true`. TypeScript provides near-zero runtime or compile-time guarantee here.
Recommendation: Add a `typecheck` script (`tsc -b`) and gate CI/deploy on it; fix errors incrementally (start at the data boundary and financial values); reconcile the two tsconfigs.
Status: New

**[TIER 2] — Monetary values are bare `number`; no `Money`/branded type**
Severity: 🟢 Low
Location: throughout (see 9a-L1).
Description: Amounts are indistinguishable from counts/percentages at the type level, enabling silent misuse.
Recommendation: Introduce a branded `Money`/cents type or a decimal library.
Status: New

### 4b. Code Quality

**[TIER 2] src/App.tsx — 10,839-line single file past the maintainability threshold**
Severity: 🟠 High
Location: entire `src/App.tsx`.
Description: One file holds auth, data layer, domain model, ~25 components, and all AI logic. This is the compounding-debt root cause behind many other findings (re-renders, no splitting, duplication, untestability).
Recommendation: Extract in seams already latent in the file: `lib/supabase.ts` (16-177), `model/` (180-724: `buildBaselineData`, `CHART_OF_ACCOUNTS`, rates), and one file per tab component. This unblocks code-splitting (3c) and testing (4c).
Status: New

**[TIER 2] src/App.tsx — Significant duplication**
Severity: 🟡 Medium
Location: Gemini endpoint+helper twice (`4766-4783` / `5673-5675`); `getActualMksSet` memo at `2188/5153/8035`; the staffing-rows set redefined 4× (`598/2097/8538/10548`); the load-and-reconcile pattern for `unit_adjustments` (`10300-10330`) copy-pasted for `xero_actuals` (`10404-10434`); two markdown renderers (`5343` safe / `5857` unsafe). The staff-cost formula is duplicated ~12× (see 9a-H3).
Recommendation: Extract shared helpers/constants; single Gemini client; single markdown renderer; single cost function.
Status: New

**[TIER 2] src/App.tsx — Silent failure: empty `catch {}` and fire-and-forget `.catch` on user-facing save paths**
Severity: 🟡 Medium
Location: empty catches at `93, 3254, 4110, 4800, 10345-10454`; `.catch(()=>{})` enrolment autosave `9629`; `.catch(console.warn/error)` on saves `10534, 10543` and many audit/sync catches.
Description: Corrupted cached payloads and failed financial saves are swallowed with no user signal — a user can believe data saved when it did not.
Recommendation: Surface save/load failures in the UI; reserve silent catches for truly ignorable cases.
Status: New

**[TIER 2] src/App.tsx — Magic numbers/strings**
Severity: 🟢 Low
Location: model ids `"gemini-2.5-flash"` (`4768/5675`), `"claude-sonnet-4-20250514"` (`4143`); table names as string literals throughout; anomaly thresholds `2.5/2.0/15000/-10000` (`4829`); opening balance `850000` (`597`); super/payroll `0.12/0.055` (24 occurrences); `|| 471` (`1529`); `value===-1` reset sentinel (`10554`); `"__wage_settings__"`/`"__cpi_settings__"`.
Recommendation: Centralise in a `constants`/`config` module (also enables the coordinated super-rate change flagged in 9a-H3).
Status: New

### 4c. Testing

**[TIER 2] — Zero tests, no CI, nothing gates PRs**
Severity: 🟠 High
Location: no test files, no `.github/workflows/`.
Description: A financial app with unvalidated calculations, broken authorisation, and 1,379 type errors has no automated safety net, and PRs (several merged from AI-branded branches) merge with no gate.
Recommendation — highest-value tests first: **(1) Financial calculation correctness** (`buildBaselineData`, `getMonthlyCost`, `build13WeekForecast`, break-even) with edge cases (zero, negative, empty, rounding, FY boundaries) — these have confirmed defects (9a) and are pure functions, easiest to test and highest risk. **(2) Authorisation** — a policy test per table asserting user A cannot read/write user B's rows (directly targets the Critical RLS findings). **(3) Input-validation schemas** once added (2d). **(4) Auth/session flows** (login, refresh, forced-change, logout revocation). **(5) A build+render smoke test** in CI plus `tsc` and `eslint` gates.
Status: New

### 4d. Configuration & Environment Management

**[TIER 1] .env.example / src — Config contract incomplete and misleading; no startup validation**
Severity: 🟡 Medium
Location: `.env.example` (no `GEMINI_API_KEY`, lists client-leaky `VITE_GEMINI_API_KEY`); `api/gemini.js` reads `process.env.GEMINI_API_KEY`; `src/App.tsx:23-28` only `console.error`s on missing Supabase config.
Description: The documented variables don't match what's consumed. Missing config surfaces as a console error (and a broken proxy returning a Gemini error), not a fail-fast. Model ids, table names, and the opening balance are hardcoded rather than configured.
Recommendation: Correct `.env.example` (add `GEMINI_API_KEY`, remove/mark `VITE_GEMINI_API_KEY` as dev-only); validate required vars at startup with a clear message; move environment-specific values to config.
Status: New

### 4e. (folded into 4d)

### 4f. Logging, Observability & Auditability

**[TIER 2] — No error tracking, no health check, non-defensible audit trail, no spend visibility**
Severity: 🟡 Medium
Location: console-only logging throughout; no Sentry; no `/health`; audit issues per 2h; no AI spend monitor.
Description: Production failures are invisible (console only), there is no dependency health check, the audit trail is forgeable (2h), and LLM spend is unmonitored.
Recommendation: Add frontend+proxy error tracking; a substantive health check; server-attributed append-only audit; a spend dashboard/alert.
Status: New

---

## Section 5: Documentation

**[TIER 3] README is the stock Vite template; no product/setup/env/deploy/runbook docs**
Severity: 🟡 Medium
Location: `README.md`; `package.json` `name: vite-react-typescript-starter`.
Description: Nothing documents what EduGrowth BI is, its architecture, the env-var reference (with public-vs-secret called out — a security artefact here), local setup against a test DB, deploy/rollback, or the portal/roles. There is no schema documentation (table purposes, monetary units/precision, the RLS model), no API documentation for `api/gemini.js`, and financial formulas (super/payroll rates, ramp curves, the `revenue*0.95` budget) carry no source citations. The StackBlitz-origin/edit-path relationship to production is undocumented.
Recommendation: Write a product README (architecture paragraph, env reference, run/deploy/rollback), a `db/` schema doc, and comments citing the source of each financial rule. Rename the package.
Status: New

---

## Section 6: Dependency & Supply Chain Health

`npm audit` (9 vulns, 6 high, dev/build-time) and CDN/SRI covered in **2i**. Additional: **`npm outdated`** shows several majors behind — `lucide-react` 0.575→1.25, `vite` 7→8, `eslint` 9→10, `typescript` 5.9→7, `@vitejs/plugin-react` 5→6 (Tier 3, 🟢 Low; upgrade deliberately, not blindly). **No `engines` field** in `package.json` — Node version for host/local is unpinned (🟢 Low). Dependencies are otherwise minimal and all imported (no obvious unused/typosquat/`postinstall` risk). `package-lock.json` is committed; use `npm ci` in any deploy path.

---

## Section 7: Operational & Deployment Readiness

**[TIER 2] — Deployment undocumented; no deploy config in repo; two edit paths can drift**
Severity: 🟡 Medium
Location: no `vercel.json`; hosting inferred (Vercel) from `api/` + `IS_PROD`; README silent; StackBlitz origin.
Description: The deploy target and process exist only as tribal knowledge. StackBlitz browser edits and git pushes are two independent paths into the same app with no stated authority — a drift and review-bypass risk.
Recommendation: Add `vercel.json` (headers, function config); document the authoritative deploy path and retire or fence off StackBlitz-to-prod.
Status: New

**[TIER 2] — No build gate: deploys can ship with 1,379 type errors and lint failures**
Severity: 🟡 Medium
Location: `package.json` scripts; no CI.
Description: `vite build` ignores type/lint state; nothing prevents a broken-typed or lint-failing commit from deploying.
Recommendation: CI running `tsc -b`, `eslint`, `build`, and tests as a required merge check.
Status: New

**[TIER 1] db/ — Unversioned, untracked migrations against a financial database; no rollback**
Severity: 🟠 High
Location: `db/*.sql` are ad-hoc `create table if not exists` scripts; 5 core tables absent; no applied-state tracking.
Description: Schema changes are applied by hand in the Supabase console with no record of what has run, no ordering, and no down-migrations — against live financial data. Existing-record behaviour under new code (the feature waves change shapes) is unmanaged.
Recommendation: Adopt a migration tool (Supabase migrations / drizzle-kit); bring all tables under it; track applied state; define a rollback path.
Status: New

**[TIER 2] — App-level "restore" trusts a forgeable log; backup/PITR status unknown; no staging**
Severity: 🟡 Medium
Location: `RestorePanel` `4342-4466`; no evidence of Supabase PITR/backup config in repo; every change hits production data.
Description: The only "restore" is the app feature that replays mutable audit rows (2h). Whether Supabase PITR/backups are enabled is unknowable from the repo — and "unknown" is itself the finding. There is no staging environment.
Recommendation: Confirm and document Supabase backups/PITR and test a restore; stand up a staging project; do not treat the app restore feature as a backup.
Status: New

---

## Section 8: TODO Cross-Reference

No `TODO.md` exists (Section 1 finding). No cross-referencing performed.

---

## Section 9: Financial-Domain & Reviewer's Discretion

### 9a. Financial Correctness

**[TIER 2] src/App.tsx:569, 813 — Variance measured against a self-referential budget (`revenue * 0.95`)**
Severity: 🟠 High
Location: `budget = revenue * 0.95` (`569`); `variance = totalRevenue - totalBudget` (`813`), where `totalRevenue` is actuals-aware (`761`).
Description: "Budget" is defined as 95% of *modeled* revenue, so variance structurally reports ≈+5% "favourable" whenever actuals track the model — it measures nothing real. This drives the headline "+$X vs Budget" figure on the dashboard.
Recommendation: Use an independent budget input (uploaded/entered), not a fraction of modeled revenue.
Status: New

**[TIER 2] src/App.tsx — Headline revenue (actuals-aware) and per-region revenue (modeled) never reconcile**
Severity: 🟠 High
Location: modeled region revenue `554/556/567/574/751`; actuals-aware operational revenue `613/675-676/761`.
Description: The headline sums actuals-aware `operationalFinancials`; the region breakdown uses modeled `count × price`. For any period containing actual months the region table will not sum to the headline.
Recommendation: Derive one revenue source of truth (actual-when-present) and distribute to regions, or explicitly label region figures "modeled".
Status: New

**[TIER 2] src/App.tsx — Staff-cost formula duplicated ~12×; the two salary tables disagree**
Severity: 🟠 High
Location: formula at `711-718`, `6064-6068`, and inline `2125, 3572-3573, 3604, 3615, 6161, 6204, 6234, 6255-6258, 6520, 6571-6572` (super `0.12`/payroll `0.055` hardcoded, 24 literal occurrences); constants disagree: `BUDGET_INPUTS` Sales `90000`/Admin `68000` (`236/232`) vs `STAFF_ROLES` sales `100000`/admin `67500` (`704/705`). Baseline uses `BUDGET_INPUTS` (`592-593`); hire deltas use `STAFF_ROLES` (`655/663/791/1463/1531`).
Description: A Sales hire is costed at $100k while the baseline sales team sits at $90k, so hiring deltas and ROI run on a different cost basis than the baseline they modify. Any super-rate change requires editing ~12 sites.
Recommendation: One salary table, one cost function, one place for statutory rates; reconcile the constants.
Status: New

**[TIER 2] src/App.tsx:182-191 — `parseDate` falls back to *today* on parse failure (non-deterministic bucketing)**
Severity: 🟠 High
Location: `183, 186, 188` return `new Date()`; feeds FY/CY period filters (`750/760/785`).
Description: Any unparsed date label silently buckets money into today's month/FY, and the result changes each day/render. `new Date(yr,mi,1)` is also local-timezone.
Recommendation: Return `null`/throw on failure and exclude the row; never substitute the current date; build dates in a fixed zone.
Status: New

**[TIER 2] src/App.tsx:289-292 — Loan principal outflows counted as operating cost / break-even base**
Severity: 🟠 High
Location: `Loan to Blocksure` ($8k/mo), `Mark Link Loan` ($150k Apr), `Nathan Baratta Loan` ($50k Mar) in the "Overheads" section; summed into `pmt` (`617-634`); `CoverageAnalyser` `totalCost += op.payments` (`8708`, `8747`).
Description: Financing principal is treated as operating expense, inflating operating payments, "cost to cover", the break-even crossover, and "students to cover cost".
Recommendation: Tag financing/loan lines and exclude them from operating-cost and break-even bases (treat separately in cash, not P&L operating cost).
Status: New

**[TIER 2] src/App.tsx:1529-1530 — Magic `$471` substituted for an unknown unit value**
Severity: 🟡 Medium
Location: `_regionAvgUnitValue(...) || 471`, `regionUnitValues.get(regionId) || 471`; `_regionAvgUnitValue` returns 0 for regions with no sellable courses (`538`).
Description: ROI/break-even for such a region silently uses $471/unit instead of flagging "unknown" — a fabricated but plausible number.
Recommendation: If unit value is 0/unknown, disable ROI and show "n/a".
Status: New

**[TIER 2] src/App.tsx — Duplicated ramp formulas (cash-flow vs ROI can silently desync)**
Severity: 🟡 Medium
Location: module-level `_getTrainerUnits`/`_getSalesUnits` (`483/515`, used at `662/793`) vs component-local `getTrainerUnits`/`getSalesUnits` (`1389/1435`, used at `1476/1539/1553`).
Description: Identical today but separate literals — an edit to one desyncs the cash-flow projection from the ROI panel.
Recommendation: Single shared ramp function.
Status: New

**[TIER 2] src/App.tsx:632-646 — Repeated mid-chain rounding compounds error**
Severity: 🟡 Medium
Location: `Math.round(months[mk]*inflation)` then `Math.round(baseline*cpiMultiplier)` (`632-633`); staff rounds at `644-646`, summed into an already-rounded `pmt` (`627`).
Description: Inflation→CPI→wage each round intermediate results across ~30 accounts before summation.
Recommendation: Keep full precision through the chain; round once at presentation (or use integer cents).
Status: New

**[TIER 2] src/App.tsx:6860 — `toISOString().slice(0,10)` on a local-midnight date → week-label off-by-one**
Severity: 🟡 Medium
Location: `6860`; `ws` built at local midnight (`_next13WeekStart` `6705`).
Description: In AEST (UTC+10/11) `toISOString()` rolls back a day, so 13-week week-start dates display a day early (can cross a month boundary).
Recommendation: Format from local date components, not UTC ISO.
Status: New

**[TIER 2] src/App.tsx:6132 — CY→FY mapping conflates two calendar years into FY26**
Severity: 🟡 Medium
Location: `{ "2025":"FY26", "2026":"FY26", "2027":"FY27", "2028":"FY28" }`.
Description: Calendar 2026 (which contains Jul–Dec 2026 = FY27) is mapped to FY26, so selecting CY2026 shows FY26 data and drops half a year.
Recommendation: A calendar year spans two FYs — split it or document the single-FY approximation explicitly.
Status: New

**[TIER 2] src/App.tsx:1759-1801 — Computed figures branded as AI output** — see 2e (same finding, correctness lens). Severity: 🟡 Medium.

**[TIER 2] src/App.tsx — Floating-point money with inconsistent rounding (revenue float vs payments int)**
Severity: 🟢 Low
Location: `revenue = count*price` unrounded (`554/556/567/574/649/694/761/8708`) vs `payments` `Math.round`ed (`617/627`); `net = revenue - pmt` (`677`) mixes them.
Description: All money is JS float; revenue is summed unrounded while payments are integer-rounded, so the two sides of net are inconsistent. Errors are sub-cent at display scale but the model is not cents-safe.
Recommendation: Standardise on integer cents (or round both sides identically at the boundary).
Status: New

**[TIER 2] src/App.tsx:6836-6857 — 13-week forecast rounds each line before accumulating the balance**
Severity: 🟢 Low
Location: `Math.round` per stream/line then summed into the running `balance`.
Description: Presentation rounding before accumulation can drift the 13-week closing balance by up to ~$13.
Recommendation: Accumulate exact values; round only for display.
Status: New

**[TIER 2] src/App.tsx:6702, 6716 — `new Date()` in render-path calcs (non-reproducible)**
Severity: 🟢 Low
Location: `_next13WeekStart(now=new Date())`, `build13WeekForecast(..., today=new Date())`.
Description: The forecast shifts with wall-clock time, making output non-deterministic/untestable.
Recommendation: Inject a fixed "as-of" date.
Status: New

**[TIER 2] src/App.tsx — `|| 0` / null-price masking conflates missing with zero**
Severity: 🟢 Low
Location: nullable `price` in `UNIT_RATES` (`~214`); `months[mk] || 0` throughout.
Description: A null-priced course yields `revenue = 0` silently; missing months coerce to zero rather than "unknown" — showing 0 for unknown is a correctness bug in a financial view.
Recommendation: Validate prices are numeric; distinguish missing from zero in the UI.
Status: New

*(Modeling note, not a bug: `getMonthlyCost` `711-718` levies payroll tax on `(gross+super)` and includes allowances in gross — confirm against the actual Australian payroll-tax/SG treatment the business uses.)*

### 9b. Accessibility

**[TIER 2] — Likely a11y gaps in the candidate-facing UI**
Severity: 🟢 Low · Confidence: Low
Location: throughout; not deeply audited.
Description: Financial gain/loss appears to rely on red/green colour (a common single-signal failure); heavy `div`-based layout; `dangerouslySetInnerHTML` content; no obvious focus management in modals or ARIA labelling. Not exhaustively verified.
Recommendation: Run an axe/Lighthouse a11y pass; ensure gain/loss has a non-colour signal (arrow/sign), labels on inputs, focus traps in modals, and adequate contrast. *(What would confirm: an automated a11y scan + keyboard/screen-reader walkthrough.)*
Status: New

### 9c. Additional Findings

**[TIER 3] — ESLint/typecheck not run anywhere; no Prettier**
Severity: 🟢 Low
Location: `lint` script exists but no CI; no formatter config.
Recommendation: Run `eslint`/`tsc` in CI; add Prettier for consistency.
Status: New

**[TIER 3] — Dead code / template scaffolding**
Severity: 🟢 Low
Location: unused imports `AreaChart` (`3`), `ChevronDown` (`10`), `Clock` (`12`), `useReducer` (`1`); unreferenced `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, and `src/App.css` (`.counter` starter styles, not imported).
Recommendation: Remove unused imports and scaffolding assets.
Status: New

**[TIER 3] — No `TODO.md`, no `LICENSE`**
Severity: 🟢 Low (LICENSE) / 🟡 Medium (TODO, per Section 1 rubric).
Recommendation: Add both; use `TODO.md` to track this review's action items.
Status: New

**Technical-debt trend:** git history shows `App.tsx` growing monotonically across feature waves (Scenario Lab, Enrolment Planner, break-even, Xero upload) with everything landing in the one file — debt is compounding in exactly the place that most needs splitting (4b).

---

## Appendix: Finding Summary Table

Sorted by Tier (1→3) then Severity (Critical→Low).

| # | Component | Tier | Section | Severity | Title | Status |
|---|-----------|------|---------|----------|-------|--------|
| 1 | db/scenarios.sql, db/xero_actuals.sql | 1 | 2c | 🔴 Critical | RLS `using(true)` — global read/write/delete for all users | New |
| 2 | db/ (core tables) | 1 | 2c | 🔴 Critical | 5 core financial tables have no versioned schema/RLS | New |
| 3 | src/App.tsx:133-160 | 1 | 2c | 🔴 Critical | `select=*` no scoping → shared global dataset (root of "different numbers") | New |
| 4 | git history / .env | 1 | 2a | 🔴 Critical | Real Gemini key committed + shipped via `VITE_` — rotate | New |
| 5 | src/App.tsx (roles) | 1 | 2b | 🔴 Critical | No authz model; destructive ops open to any user | New |
| 6 | api/gemini.js | 1 | 2e | 🟠 High | Open, unauthenticated, unmetered LLM proxy | New |
| 7 | src/App.tsx:163-177 | 1 | 2h | 🟠 High | Audit log client-attributed, forgeable, deletable, not append-only | New |
| 8 | people_overrides / audit_log | 1 | 2h | 🟠 High | Salaries + identity readable/writable org-wide | New |
| 9 | api/gemini.js, login | 1 | 2g | 🟠 High | No rate limiting on proxy or login | New |
| 10 | src/App.tsx:141-146 | 1 | 2d | 🟠 High | No write-boundary validation; mass-assignment / row impersonation | New |
| 11 | db/ + data model | 1 | 2c | 🟠 High | No monetary types/constraints; amounts in untyped JSON | New |
| 12 | db/ | 1 | 7 | 🟠 High | Unversioned untracked migrations; no rollback | New |
| 13 | src/App.tsx:88-96 | 1 | 2b | 🟡 Medium | Logout doesn't reliably revoke refresh token | New |
| 14 | src/App.tsx:98-105 | 1 | 2b | 🟡 Medium | `must_change_password` client-side & self-clearable | New |
| 15 | .env.example / src | 1 | 4d | 🟡 Medium | Config contract incomplete/misleading; no startup validation | New |
| 16 | src/App.tsx:4768,5675 | 2 | 2a | 🟠 High | `VITE_GEMINI_API_KEY` in client URL on dev path | New |
| 17 | src/App.tsx:5855-5872 | 2 | 2d | 🟠 High | XSS via `dangerouslySetInnerHTML` on AI output | New |
| 18 | src/App.tsx:79-84 | 2 | 2b | 🟠 High | Session + refresh token in `sessionStorage` | New |
| 19 | src/App.tsx (build) | 2 | 4a | 🟠 High | `tsc` fails (1,379 errors); build never typechecks | New |
| 20 | src/App.tsx (bundle) | 2 | 3c | 🟠 High | 996 KB monolith; no code-splitting | New |
| 21 | src/App.tsx | 2 | 4b | 🟠 High | 10,839-line single file past maintainability threshold | New |
| 22 | repo | 2 | 4c | 🟠 High | Zero tests, no CI gate | New |
| 23 | src/App.tsx:569,813 | 2 | 9a | 🟠 High | Variance vs self-referential budget (`revenue*0.95`) | New |
| 24 | src/App.tsx (revenue) | 2 | 9a | 🟠 High | Headline (actuals) vs region (modeled) revenue don't reconcile | New |
| 25 | src/App.tsx (staff cost) | 2 | 9a | 🟠 High | Staff-cost formula ×12; salary tables disagree | New |
| 26 | src/App.tsx:182-191 | 2 | 9a | 🟠 High | `parseDate` falls back to today() | New |
| 27 | src/App.tsx:289-292 | 2 | 9a | 🟠 High | Loan principal counted as operating cost / break-even | New |
| 28 | db/ (Postgres deps) | 2 | 7 | 🟠 High | App restore trusts forgeable log; backup/PITR unknown; no staging | New |
| 29 | src/App.tsx:4139 | 2 | 2a | 🟡 Medium | Dead direct-to-Anthropic browser call (broken + anti-pattern) | New |
| 30 | src/App.tsx (prompts) | 2 | 2e | 🟡 Medium | No prompt-injection hardening; output drives figures | New |
| 31 | src/App.tsx:5751-5829 | 2 | 2e | 🟡 Medium | Financial data + email sent to Gemini; no consent/minimisation (APP 8) | New |
| 32 | src/App.tsx:1759-1801 | 2 | 2e/9a | 🟡 Medium | AI vs computed figures indistinguishable | New |
| 33 | api/gemini.js | 2 | 2e/4f | 🟡 Medium | No AI audit log / spend monitoring | New |
| 34 | src/App.tsx (console) | 2 | 2f | 🟡 Medium | PII/financial/AI data in `console.log` | New |
| 35 | repo (headers) | 2 | 2g | 🟡 Medium | No security headers/CSP/HSTS; no deploy config | New |
| 36 | src/App.tsx (localStorage) | 2 | 2h | 🟡 Medium | Financial PII in localStorage, survives logout; no export/delete | New |
| 37 | src/App.tsx:76,3238 | 2 | 2b | 🟡 Medium | Login error enumeration; no client rate-limit | New |
| 38 | package-lock | 2 | 2i | 🟡 Medium | npm audit: 9 vulns (6 high) dev/build-time | New |
| 39 | index.html | 2 | 2i | 🟡 Medium | Tailwind dev CDN + SheetJS, no SRI | New |
| 40 | src/App.tsx:10289-10458 | 2 | 3a | 🟡 Medium | 5-request serial load waterfall | New |
| 41 | src/App.tsx (lists) | 2 | 3a | 🟡 Medium | No pagination; unbounded/whole-table reads | New |
| 42 | src/App.tsx:10790-10807 | 2 | 3c | 🟡 Medium | Whole-app re-render; unmemoised props/callbacks | New |
| 43 | src/App.tsx:4914 | 2 | 3c | 🟡 Medium | `useEffect(()=>runScan(),[])` stale closure | New |
| 44 | src/App.tsx | 2 | 4b | 🟡 Medium | Significant duplication (Gemini, cost formula, renderers) | New |
| 45 | src/App.tsx (catches) | 2 | 4b | 🟡 Medium | Silent empty catches / failed saves invisible | New |
| 46 | repo (CI) | 2 | 7 | 🟡 Medium | No build/typecheck/lint gate | New |
| 47 | repo | 2 | 7 | 🟡 Medium | Deployment undocumented; StackBlitz+git drift | New |
| 48 | src/App.tsx / api | 2 | 4f | 🟡 Medium | No error tracking / health check | New |
| 49 | src/App.tsx:1529 | 2 | 9a | 🟡 Medium | Magic `$471` for unknown unit value | New |
| 50 | src/App.tsx (ramps) | 2 | 9a | 🟡 Medium | Duplicated ramp formulas can desync | New |
| 51 | src/App.tsx:632-646 | 2 | 9a | 🟡 Medium | Mid-chain rounding compounds error | New |
| 52 | src/App.tsx:6860 | 2 | 9a | 🟡 Medium | `toISOString` timezone off-by-one week labels | New |
| 53 | src/App.tsx:6132 | 2 | 9a | 🟡 Medium | CY→FY mapping conflates two calendar years | New |
| 54 | src/App.tsx (money) | 2 | 9a | 🟢 Low | Float money; revenue unrounded vs payments rounded | New |
| 55 | src/App.tsx:6836-6857 | 2 | 9a | 🟢 Low | 13-week rounding-before-accumulate drift | New |
| 56 | src/App.tsx:6702,6716 | 2 | 9a | 🟢 Low | `new Date()` in render-path calcs | New |
| 57 | src/App.tsx (||0) | 2 | 9a | 🟢 Low | `||0`/null-price masks missing as zero | New |
| 58 | src/App.tsx | 2 | 4a | 🟢 Low | Money is bare `number`; no Money type | New |
| 59 | src/App.tsx (keys) | 2 | 3c | 🟢 Low | Index-as-key; no virtualisation; fetch without abort | New |
| 60 | src/App.tsx | 2 | 4b | 🟢 Low | Magic numbers/strings | New |
| 61 | src/App.tsx:46-58 | 2 | 2g | 🟢 Low | Error helper reflects upstream body to client | New |
| 62 | api/gemini.js | 2 | 3b | 🟢 Low | Proxy has no timeout/retry/circuit-breaker | New |
| 63 | src/App.tsx | 2 | 9b | 🟢 Low | Accessibility gaps (Confidence: Low) | New |
| 64 | README.md | 3 | 5 | 🟡 Medium | Stock template README; no product/env/deploy docs | New |
| 65 | repo | 3 | 1/8 | 🟡 Medium | No `TODO.md` | New |
| 66 | package.json | 3 | 6 | 🟢 Low | Deps majors behind; no `engines` field | New |
| 67 | repo | 3 | 9c | 🟢 Low | ESLint/typecheck not run; no Prettier | New |
| 68 | src/assets, App.css | 3 | 9c | 🟢 Low | Dead code / template scaffolding | New |
| 69 | repo | 3 | 1 | 🟢 Low | No LICENSE | New |

**Total findings:** 69 (Critical: 5, High: 17, Medium: 30, Low: 17)

---

*End of review. See `action-items-2026-07-20.md` for the distilled, execution-ordered action list.*
