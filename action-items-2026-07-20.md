# ABCFinancialAI Action Items — 2026-07-20

Derived from [code-review-2026-07-20.md](./code-review-2026-07-20.md). Items are listed in execution order: Critical first, then High, then Medium grouped by theme, then Low. Each item is independently actionable and references its finding by appendix number (e.g. `#4` → row 4 of the Appendix Finding Summary Table) and originating section.

Priority key: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 Critical (do first)

### 1. Rotate the exposed Gemini API key
_Partial 2026-07-20 — code no longer ships any key (see #2); remaining is operator-only: delete leaked keys `…l-8cI`/`…0hOhA` in Google Cloud Console and set a new `GEMINI_API_KEY` in Vercel. Cannot be done from the repo._
- **Why:** A real `VITE_GEMINI_API_KEY` was committed to git history (initial commit + two changes) and, being `VITE_`-prefixed, was inlined into every deployed browser bundle. It is public and compromised; removing `.env` from tracking does not un-leak it.
- **What:** Revoke the exposed key in Google AI Studio / Cloud and issue a new one. Store the new key only as the server-side `GEMINI_API_KEY` (never `VITE_`). Optionally scrub history with `git filter-repo`/BFG for hygiene.
- **Where:** git history (`3dd6f1f`, `20aaa52`, `23b7b5c`); `.env.example`
- **Refs:** Review #4 (Section 2a)

### ~~2. Serve Gemini only through the server proxy; delete the client-side key path~~
_Done 2026-07-20 — `GEMINI_BASE`/`GEMINI_URL` now always `/api/gemini`; `VITE_GEMINI_API_KEY` removed from `.env.example` (replaced with server-side `GEMINI_API_KEY`); bundle verified clean of key + direct Google call (commit 5c596d4)._
- **Why:** Even after rotation, the code still ships the key to the browser on any non-prod/preview host via the direct-call branch.
- **What:** Remove the `GEMINI_BASE`/`GEMINI_URL` direct-call branches; always call `/api/gemini`. Remove `VITE_GEMINI_API_KEY` from `.env.example`. Run the proxy locally for dev.
- **Where:** `src/App.tsx:4766-4768`, `5673-5675`; `.env.example`
- **Refs:** Review #4, #16 (Section 2a)

### 3. Gate destructive/admin operations behind a real role model
_Partial 2026-07-20 — role model + UI/handler gating for Reset, Restore, and Xero upload/clear implemented (commit f232a7e: `db/roles_and_rls.sql` + `src/App.tsx` `isAdmin`). Remaining: run `db/roles_and_rls.sql` in Supabase and bootstrap the first admin — not enforced until then._
- **Why:** No authorisation model exists; any authenticated user can "Reset all data", run a whole-org restore, or overwrite shared actuals.
- **What:** Add a `user_roles`/`profiles` table keyed by `auth.uid()`; check role in RLS `USING`/`WITH CHECK` and in the UI before Reset/Restore/Xero-clear.
- **Where:** `src/App.tsx:10754-10764` (reset), `4342-4466` (restore), `10529-10543` (xero); DB policies
- **Refs:** Review #5 (Section 2b)

### 4. Replace every `using(true)` RLS policy with ownership/tenant scoping
_Partial 2026-07-20 — policies rewritten in `db/scenarios.sql`, `db/xero_actuals.sql`, and `db/roles_and_rls.sql` (commit f232a7e): shared read, owner-or-admin/admin-only writes, DELETE admin-only. Remaining: run these in Supabase AND drop any pre-existing blanket `using(true)` policies (Postgres OR-combines policies, so leftovers silently keep granting everything)._
- **Why:** `for all to authenticated using(true) with check(true)` lets every logged-in user read, overwrite, and delete all rows — including other users' financial data and salaries.
- **What:** Rewrite policies to scope by `auth.uid()`/email or an org model; separate read vs write policies; set owner columns server-side (DB default), never from the client body.
- **Where:** `db/scenarios.sql:21-27,42-48`; `db/xero_actuals.sql:23-29`
- **Refs:** Review #1 (Section 2c)

### 5. Bring all table schemas + RLS into version control and verify RLS is enabled
_Partial 2026-07-20 — best-effort schemas + RLS for all 8 tables (incl. the 5 previously-unversioned core tables and `audit_log` made append-only) now tracked in `db/roles_and_rls.sql` (commit f232a7e). Remaining: reconcile the inferred column types against production via `supabase db pull`, then run and confirm `enable row level security` on each in Supabase._
- **Why:** The 5 most sensitive tables (incl. salaries and the audit log) have no schema/policy in the repo — their production authorisation is unauditable and likely the same blanket policy or RLS-off.
- **What:** Export full schema + RLS for `unit_adjustments`, `coa_adjustments`, `hiring_plan`, `people_overrides`, `audit_log` (and the existing three) into tracked migrations; confirm `alter table … enable row level security` on each; review every policy line-by-line.
- **Where:** `db/`; tables used at `src/App.tsx:133-177, 4358, 10293-10636`
- **Refs:** Review #2 (Section 2c)

### 6. Add per-user/tenant scoping to data reads and resolve the localStorage/DB race
- **Why:** `sbGet` fetches `select=*` with no scope, making all financial data one shared pool — the direct cause of the reported "different logins see different numbers" symptom, compounded by per-browser caches racing the shared `xero_actuals` row.
- **What:** Decide and document the data model (single-org-shared vs per-user). If per-user, filter every read/write by owner in both RLS and queries. Either way, make the shared DB row the single source of truth and stop layering stale `localStorage` over it.
- **Where:** `src/App.tsx:133-160`, `10294-10298`
- **Refs:** Review #3 (Section 2c) — ties to the open "login counts" issue

---

## 🟠 High (do before next release)

### 7. Model financial amounts with proper types/constraints
- **Why:** Amounts live in untyped JSON/text written as JS floats, with no constraints — `NaN`/negative/malformed values are silently storable.
- **What:** Use `numeric`/decimal columns or integer minor units with CHECK/NOT NULL constraints; or at minimum validate range/shape at write time.
- **Where:** `db/*.sql`; `src/App.tsx:10429`, `4384`
- **Refs:** Review #11 (Section 2c)

### 8. Validate every write at the boundary; stop trusting client identity columns
- **Why:** No schema validation before Supabase writes; clients set `user_email`/`id` themselves, enabling row impersonation and arbitrary shapes into salary/financial fields.
- **What:** Add Zod (or similar) validation in `sbUpsert` call sites; set owner/id columns from `auth.uid()` server-side; reject client-supplied identity.
- **Where:** `src/App.tsx:141-146`, `8958`, `9627`, `10542`
- **Refs:** Review #10 (Section 2d)

### 9. Add authentication + rate limiting to the Gemini proxy
- **Why:** `api/gemini.js` is an open, unmetered relay to a paid LLM on the public domain — anyone can burn the customer's budget.
- **What:** Verify a Supabase JWT server-side; add per-user rate limiting and a spend cap; cap request size; restrict CORS to the app origin.
- **Where:** `api/gemini.js:1-15`
- **Refs:** Review #6, #9 (Section 2e, 2g)

### 10. Make the audit log server-attributed and append-only
- **Why:** Audit rows are client-attributed and forgeable/deletable, and the restore feature rewrites financial state by trusting them — a tampered log becomes a corruption vector, and the trail is not defensible.
- **What:** RLS INSERT-only on `audit_log`; set actor from `auth.uid()` and `created_at` from `default now()`; ignore client `id`/`user_email`/timestamps; consider hash-chaining; stop reconstructing financial state from mutable rows.
- **Where:** `src/App.tsx:163-177`, `4358-4404`
- **Refs:** Review #7 (Section 2h)

### 11. Restrict salary/identity data to authorised roles
- **Why:** Under blanket RLS, every user can read/alter individual staff salaries and all audit identity (APP 6/11 exposure).
- **What:** Scope `people_overrides` and audit reads by role/ownership once #3–#5 land.
- **Where:** `people_overrides` (`src/App.tsx:10599-10636`), audit (`167-168`)
- **Refs:** Review #8 (Section 2h)

### 12. Adopt tracked, reversible DB migrations
- **Why:** Schema changes are applied by hand with no record, ordering, or rollback — against live financial data.
- **What:** Use Supabase migrations / drizzle-kit; bring all tables under it; track applied state; define down-migrations and a rollback path.
- **Where:** `db/`
- **Refs:** Review #12 (Section 7)

### 13. Fix the AI-output XSS
- **Why:** Gemini output (and shared-data-derived content) is rendered as raw HTML — a stored-XSS path across users, which also amplifies the sessionStorage token risk.
- **What:** Render as text or sanitise with DOMPurify + allowlist; reuse the safe renderer at `5343`.
- **Where:** `src/App.tsx:5862, 5865, 5868, 5871`
- **Refs:** Review #17 (Section 2d)

### 14. Move the session/refresh token out of `sessionStorage`
- **Why:** The long-lived refresh token in web storage means any XSS is a durable account takeover.
- **What:** Use Supabase's cookie-based session strategy (or at least stop persisting the refresh token in web storage).
- **Where:** `src/App.tsx:79-84`, `61`
- **Refs:** Review #18 (Section 2b)

### 15. Add a typecheck gate and start fixing the 1,379 type errors
- **Why:** `tsc` fails hard and never runs in the build, so TypeScript provides no guarantee and the app ships broken-typed.
- **What:** Add a `typecheck` script (`tsc -b`) and make it a required CI/deploy check; fix errors incrementally starting at the data boundary and financial values; reconcile the two contradictory tsconfigs.
- **Where:** `package.json`; `tsconfig.json` vs `tsconfig.app.json`; `src/App.tsx`
- **Refs:** Review #19 (Section 4a)

### 16. Code-split the tab components
- **Why:** A single 996 KB chunk loads all 25 tabs + recharts up front.
- **What:** Extract tab components to files and `React.lazy` them behind `Suspense`; lazy-load recharts.
- **Where:** `src/App.tsx:8695-9506`, `1368-2097`, `6006-6674`, `9577-10118`, etc.
- **Refs:** Review #20 (Section 3c)

### 17. Split `src/App.tsx` into modules
- **Why:** One 10,839-line file is the compounding-debt root behind the re-render, splitting, duplication, and testability findings.
- **What:** Extract `lib/supabase.ts` (16-177), `model/` (180-724), and one file per tab component.
- **Where:** `src/App.tsx`
- **Refs:** Review #21 (Section 4b)

### 18. Stand up a test harness and write the top-5 tests
- **Why:** A financial app with confirmed calc defects and broken authorisation has no safety net, and PRs merge with no gate.
- **What:** Add Vitest + Testing Library; write, in order: (1) financial-calc correctness with edge cases, (2) an RLS/authorisation test per table (A cannot reach B), (3) input-validation schemas, (4) auth/session flows, (5) build+render smoke test; gate CI on tests + `tsc` + `eslint`.
- **Where:** repo
- **Refs:** Review #22 (Section 4c)

### 19. Fix the self-referential budget
- **Why:** `budget = revenue * 0.95` makes the dashboard's headline variance structurally ≈+5% favourable and meaningless.
- **What:** Use an independent budget input (entered/uploaded), not a fraction of modeled revenue.
- **Where:** `src/App.tsx:569`, `813`
- **Refs:** Review #23 (Section 9a)

### 20. Reconcile headline vs per-region revenue
- **Why:** Headline revenue is actuals-aware while region revenue is modeled, so the region table never sums to the headline for periods with actuals.
- **What:** Derive one revenue source of truth (actual-when-present) and distribute to regions, or explicitly label region figures "modeled".
- **Where:** `src/App.tsx:554/556/567/574/751` vs `613/675-676/761`
- **Refs:** Review #24 (Section 9a)

### 21. Unify the staff-cost formula and salary tables
- **Why:** The cost formula (with hardcoded super/payroll rates) is duplicated ~12×, and the two salary tables disagree (Sales $90k vs $100k; Admin $68k vs $67.5k), so hire deltas and ROI use a different basis than the baseline.
- **What:** One salary table, one cost function, one place for statutory rates; reconcile the constants.
- **Where:** `src/App.tsx:711-718`, `6064-6068`, and inline `2125/3572-3573/3604/3615/6161/6204/6234/6255-6258/6520/6571-6572`; constants `232/236/704/705`
- **Refs:** Review #25 (Section 9a)

### 22. Stop `parseDate` from substituting today's date
- **Why:** Any unparsed label silently buckets money into the current month/FY and changes every day/render.
- **What:** Return `null`/throw on parse failure and exclude the row; build dates in a fixed zone.
- **Where:** `src/App.tsx:182-191`
- **Refs:** Review #26 (Section 9a)

### 23. Exclude loan principal from operating cost and break-even
- **Why:** Loan principal outflows filed under "Overheads" inflate operating payments, cost-to-cover, and the break-even crossover.
- **What:** Tag financing/loan lines and exclude them from operating-cost/break-even bases; treat as cash financing, not P&L operating cost.
- **Where:** `src/App.tsx:289-292`, `617-634`, `8708`, `8747`
- **Refs:** Review #27 (Section 9a)

### 24. Confirm and document backups; stop treating app-restore as backup; add staging
- **Why:** The only "restore" replays a forgeable log; whether Supabase PITR/backups are enabled is unknowable from the repo; every change hits production data.
- **What:** Enable and document Supabase PITR/backups and test a restore; stand up a staging Supabase project; separate the app restore feature from disaster recovery.
- **Where:** `src/App.tsx:4342-4466`; Supabase project config
- **Refs:** Review #28 (Section 7)

---

## 🟡 Medium — Security hardening

### 25. Remove or proxy the dead direct-to-Anthropic call
- **What:** Delete `CodeAuditAgent`'s browser call (broken: no key/version/CORS) or route it through a server proxy with auth; never add a key client-side.
- **Where:** `src/App.tsx:4139-4148`
- **Refs:** Review #29 (Section 2a)

### 26. Harden prompts against injection
- **What:** Delimit/label untrusted shared content, harden the system prompt against override, and treat outputs as advisory (validate before display).
- **Where:** `src/App.tsx:5697-5802`, `4770-4783`, `4126-4147`
- **Refs:** Review #30 (Section 2e)

### 27. Minimise and disclose data sent to Gemini
- **Why:** Financial figures and the user's email go to Google Gemini with no consent or minimisation (APP 8 cross-border exposure — risk flag for the customer's own legal advice).
- **What:** Aggregate/strip identifiers before sending; add a consent/disclosure point; document provider, region, retention.
- **Where:** `src/App.tsx:5751-5829`, `4770-4783`
- **Refs:** Review #31 (Section 2e)

### 28. Distinguish AI-generated from computed figures
- **What:** Label deterministic outputs "Calculated"; confine the AI/Gemini badge to prose.
- **Where:** `src/App.tsx:1759-1801`
- **Refs:** Review #32 (Section 2e/9a)

### 29. Add an AI audit log and spend monitoring
- **What:** Log AI calls server-side (minimised: model, input hash, user, timestamp) and surface Gemini spend to an operator.
- **Where:** `api/gemini.js`
- **Refs:** Review #33 (Section 2e/4f)

### 30. Strip PII/financial `console.log`s from shipped code
- **What:** Remove/gate the login user-object, wage/CPI, and AI-output logs.
- **Where:** `src/App.tsx:3233, 3235, 5838, 595, 10385, 10393`
- **Refs:** Review #34 (Section 2f)

### 31. Add security headers via deploy config
- **What:** Add a `vercel.json` `headers` block (HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy); work toward a CSP after removing CDN scripts.
- **Where:** new `vercel.json`; `index.html`
- **Refs:** Review #35 (Section 2g)

### 32. Clear financial localStorage on logout; add data export/delete
- **Why:** Salary/financial data persists in clear text after logout; no APP 12/13 export or subject-scoped delete exists.
- **What:** Clear the 13 financial keys on `sbSignOut`; add export and subject-scoped deletion; document retention.
- **Where:** `src/App.tsx:95`, `10339-10413`, `5453`, `3476`
- **Refs:** Review #36 (Section 2h)

### 33. Make login errors generic; add client throttling
- **What:** Show one "invalid email or password" message; add a captcha/backoff on repeated failures.
- **Where:** `src/App.tsx:76`, `3238-3239`
- **Refs:** Review #37 (Section 2b)

### 34. Patch vulnerable build dependencies
- **What:** Run `npm audit fix`; bump `vite`/`postcss`/`picomatch`; re-verify the build.
- **Where:** `package-lock.json`
- **Refs:** Review #38 (Section 2i)

### 35. Remove CDN scripts; bundle Tailwind and SheetJS
- **Why:** `cdn.tailwindcss.com` is a dev-only CDN and a runtime third-party dependency; neither CDN script has SRI.
- **What:** Use the already-present Tailwind devDependency as a build step; install SheetJS via npm; SRI-pin anything that must stay on a CDN.
- **Where:** `index.html`
- **Refs:** Review #39 (Section 2i)

### 36. Handle logout revocation reliably
- **What:** Await `/auth/v1/logout` success; on failure surface/retry; consider global scope.
- **Where:** `src/App.tsx:88-96`
- **Refs:** Review #13 (Section 2b)

### 37. Stop trusting `must_change_password` from user-writable metadata
- **What:** Track forced-change server-side (a column the user cannot self-update), or treat the gate as pure UX and document that.
- **Where:** `src/App.tsx:98-105`, `3236`
- **Refs:** Review #14 (Section 2b)

## 🟡 Medium — Financial correctness

### 38. Single shared ramp function
- **What:** Deduplicate the trainer/sales ramp so the cash-flow projection and ROI panel can't desync.
- **Where:** `src/App.tsx:483/515` vs `1389/1435`
- **Refs:** Review #50 (Section 9a)

### 39. Round once at presentation, not mid-chain
- **What:** Keep full precision through inflation→CPI→wage; round once at display (or use integer cents).
- **Where:** `src/App.tsx:632-646`, `627`
- **Refs:** Review #51 (Section 9a)

### 40. Fix timezone off-by-one in 13-week week labels
- **What:** Format week-start from local date components, not `toISOString()`.
- **Where:** `src/App.tsx:6860`, `6705`
- **Refs:** Review #52 (Section 9a)

### 41. Fix the CY→FY mapping
- **What:** A calendar year spans two FYs; split it or explicitly document the single-FY approximation.
- **Where:** `src/App.tsx:6132`
- **Refs:** Review #53 (Section 9a)

### 42. Don't fabricate `$471` for unknown unit value
- **What:** When unit value is 0/unknown, disable ROI and show "n/a".
- **Where:** `src/App.tsx:1529-1530`, `538`
- **Refs:** Review #49 (Section 9a)

## 🟡 Medium — Performance

### 43. Parallelise the login data load
- **What:** `Promise.all` the five independent `sbGet` reads.
- **Where:** `src/App.tsx:10293, 10332, 10361, 10372, 10405`
- **Refs:** Review #40 (Section 3a)

### 44. Paginate list reads and bound growing tables
- **What:** Add `.limit()`/server-side filtering and pagination; index ordering/filter columns.
- **Where:** `src/App.tsx:4578, 4705`; `select=*` reads
- **Refs:** Review #41 (Section 3a)

### 45. Stop whole-app re-render on every edit
- **What:** `useMemo`/`useCallback` the prop bundles and callbacks; `React.memo` tab components.
- **Where:** `src/App.tsx:10790-10807`
- **Refs:** Review #42 (Section 3c)

### 46. Fix the anomaly-scan stale closure
- **What:** Depend on `[runScan]` (session cache already prevents rescans).
- **Where:** `src/App.tsx:4914`
- **Refs:** Review #43 (Section 3c)

## 🟡 Medium — Architecture & code health

### 47. Remove duplication
- **What:** Single Gemini client/constant; single markdown renderer; shared `getActualMksSet` and staffing-rows set; shared load-and-reconcile helper.
- **Where:** `src/App.tsx:4766-4783`/`5673-5675`, `5343`/`5857`, `2188/5153/8035`, `598/2097/8538/10548`, `10300-10330`/`10404-10434`
- **Refs:** Review #44 (Section 4b)

### 48. Surface save/load failures to the user
- **What:** Replace empty catches and `.catch(console.*)` on save paths with user-visible error handling.
- **Where:** `src/App.tsx:93, 3254, 4110, 4800, 9629, 10345-10454, 10534, 10543`
- **Refs:** Review #45 (Section 4b)

### 49. Add error tracking and a health check
- **What:** Add frontend + proxy error tracking (e.g. Sentry) and a substantive `/health` verifying dependencies.
- **Where:** `src/App.tsx`, `api/`
- **Refs:** Review #48 (Section 4f)

## 🟡 Medium — Configuration & operational

### 50. Correct `.env.example` and validate config at startup
- **What:** Add `GEMINI_API_KEY`; remove/mark `VITE_GEMINI_API_KEY` as dev-only; fail fast with a clear message when required vars are missing; move model ids/table names/opening balance to config.
- **Where:** `.env.example`; `src/App.tsx:23-28`
- **Refs:** Review #15 (Section 4d)

## 🟡 Medium — Deployment hygiene

### 51. Add a CI build gate
- **What:** CI running `tsc -b`, `eslint`, `build`, and tests as a required merge check.
- **Where:** new `.github/workflows/`
- **Refs:** Review #46 (Section 7)

### 52. Document the deployment and settle the edit path
- **What:** Add `vercel.json`; document the authoritative deploy path; retire or fence StackBlitz-to-prod.
- **Where:** repo
- **Refs:** Review #47 (Section 7)

## 🟡 Medium — Documentation & dependency hygiene

### 53. Write a product README and schema/API docs
- **What:** Replace the stock README with product purpose, architecture, env reference (public vs secret), local setup against a test DB, deploy/rollback; document the `db/` schema (units/precision, RLS model) and `api/gemini.js`; rename the package.
- **Where:** `README.md`; `package.json`; `db/`
- **Refs:** Review #64 (Section 5)

### 54. Add a `TODO.md`
- **What:** Track this review's action items in a repo `TODO.md`.
- **Where:** repo
- **Refs:** Review #65 (Section 1/8)

---

## 🟢 Low (do when convenient)

### 55. Give money a distinct type and standardise cents
- **What:** Introduce a branded `Money`/integer-cents type; round revenue and payments identically at the boundary.
- **Where:** `src/App.tsx` (money throughout; `554/617/627/677`)
- **Refs:** Review #54, #58 (Section 9a, 4a)

### 56. Accumulate exact values in the 13-week forecast
- **What:** Sum exact figures; round only for display.
- **Where:** `src/App.tsx:6836-6857`
- **Refs:** Review #55 (Section 9a)

### 57. Inject a fixed "as-of" date into forecast calcs
- **What:** Pass an explicit as-of date instead of `new Date()` in render-path calcs.
- **Where:** `src/App.tsx:6702, 6716`
- **Refs:** Review #56 (Section 9a)

### 58. Distinguish missing from zero
- **What:** Validate prices are numeric; show "unknown" (not 0) for absent months/values.
- **Where:** `src/App.tsx:~214`, `||0` sites
- **Refs:** Review #57 (Section 9a)

### 59. Use stable list keys; virtualise growing tables; abort fetches
- **What:** Replace index keys with stable ids; virtualise the audit log and P&L table; add `AbortController` cleanup to fetch effects.
- **Where:** `src/App.tsx:4705, 5936, 8299, 5067/5094/5118, 9474/10097/10105, 3196`; `4573-4587`
- **Refs:** Review #59 (Section 3c)

### 60. Centralise magic numbers/strings
- **What:** Move model ids, table names, statutory rates, thresholds, sentinels, and the opening balance into a constants/config module.
- **Where:** `src/App.tsx` (`4768/5675/4143`, table literals, `4829`, `597`, `0.12/0.055`, `1529`, `10554`)
- **Refs:** Review #60 (Section 4b)

### 61. Add a proxy timeout/retry
- **What:** Add an `AbortController` timeout and bounded retry to the Gemini fetch.
- **Where:** `api/gemini.js`
- **Refs:** Review #62 (Section 3b)

### 62. Stop reflecting upstream response bodies to the client
- **What:** Log the upstream detail; show the user a generic message.
- **Where:** `src/App.tsx:46-58`
- **Refs:** Review #61 (Section 2g)

### 63. Run an accessibility pass
- **What:** axe/Lighthouse audit; add a non-colour signal for gain/loss, input labels, modal focus traps, contrast fixes.
- **Where:** `src/App.tsx` (UI)
- **Refs:** Review #63 (Section 9b)
- _Confidence: Low — not exhaustively audited; an automated a11y scan + keyboard/screen-reader walkthrough would confirm scope._

### 64. Run ESLint/typecheck and add a formatter
- **What:** Run `eslint` and `tsc` in CI; add Prettier for consistency.
- **Where:** repo
- **Refs:** Review #67 (Section 9c)

### 65. Remove dead code and template scaffolding
- **What:** Drop unused imports (`AreaChart`, `ChevronDown`, `Clock`, `useReducer`) and unreferenced `src/assets/{react,vite}.svg`, `hero.png`, `src/App.css`.
- **Where:** `src/App.tsx:1,3,10,12`; `src/assets/`; `src/App.css`
- **Refs:** Review #68 (Section 9c)

### 66. Plan deliberate dependency upgrades; pin Node
- **What:** Schedule major upgrades (lucide-react, vite, eslint, typescript); add an `engines` field.
- **Where:** `package.json`
- **Refs:** Review #66 (Section 6)

### 67. Add a LICENSE
- **What:** Add an appropriate license file.
- **Where:** repo
- **Refs:** Review #69 (Section 1)

---

*End of action items. See [code-review-2026-07-20.md](./code-review-2026-07-20.md) for full context, severity definitions, and the executive summary.*
