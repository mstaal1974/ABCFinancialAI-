# Maison Obsidian

A premium "Boutique Laboratory" e-commerce MVP for a fragrance brand built around the **batch-commit** model: customers reserve a spot in a small pour run, their card is **authorized but never charged** until the batch reaches MOQ, and the perfumer ships engraved bottles only when the threshold is met.

> **Aesthetic** — Modern Apothecary × High-End Minimalist. Deep obsidian, gold accents, parchment cream, serif headings, sans-serif data.

---

## Quickstart

```bash
npm install
npm run dev
```

The app runs at <http://localhost:5173>. No database connection is required to demo the full UX — the catalogue, batch counter, custom-label preview, commit drawer, and VIP enrollment all work offline against the seed data in `src/lib/data.ts`.

### Environment

`.env` already contains a Supabase project URL + anon key for live persistence. To swap in your own:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

When Supabase is reachable and `fragrances` rows exist, the app reads live `committed` counts from the database and writes new commits there. Otherwise it gracefully falls back to seed data + `localStorage`.

---

## Architecture

```
src/
├── App.tsx                       Hash-routed shell (#/fragrance/:slug)
├── index.css                     Tailwind v4 + custom @theme tokens
├── components/
│   ├── Header.tsx                Sticky nav with commit count + VIP badge
│   ├── Hero.tsx                  Atmospheric landing + 4 brand pillars
│   ├── Vault.tsx                 Catalogue grid (3-up)
│   ├── FragranceCard.tsx         Card with bottle preview + batch progress
│   ├── BatchProgress.tsx         "12/20 spots filled" bar w/ shimmer
│   ├── ProductDetail.tsx         Full PDP + Custom Label Engine + commit CTA
│   ├── Bottle.tsx                SVG 2D bottle mockup w/ live engraving
│   ├── Education.tsx             "The Method" — 4 brand pillars
│   ├── VIPClub.tsx               Subscription tier — early-access perks
│   ├── CommitDrawer.tsx          Slide-out cart of authorized commits
│   └── Footer.tsx
└── lib/
    ├── types.ts                  Domain types
    ├── data.ts                   Seed catalogue (mirrors SQL seed)
    ├── store.ts                  React hooks: useFragrances(), useVIP()
    ├── supabase.ts               Supabase client (null-safe)
    └── stripe.ts                 Authorize-now / capture-later stub
supabase/
└── migrations/0001_init.sql      Tables + RLS + auto-sync trigger + seed
```

### The Batch System

1. Each fragrance has an MOQ (e.g. 20). The card shows `committed/moq` as a gold progress bar.
2. **Commit to Batch** authorizes the customer's card via Stripe (`capture_method: "manual"`, see `src/lib/stripe.ts`) — no money moves yet.
3. The trigger in `supabase/migrations/0001_init.sql` auto-increments `fragrances.committed` on every new row in `commits`.
4. When `committed >= moq`, the frontend fires `notifyAdminBatchClosed()` (currently a console hook — wire to Slack/Email/SMS in production) and the admin captures all `authorized` payment intents in one batch.
5. If the batch closes short by `batch_closes_at`, all holds are released and customers are never billed.

### Stripe wiring (production)

The Stripe stub lives at `src/lib/stripe.ts`. To go live, replace `authorizePayment` with a call to a Next.js / Express / Supabase Edge Function that:

```ts
const intent = await stripe.paymentIntents.create({
  amount: priceCents,
  currency: "usd",
  capture_method: "manual",
  metadata: { fragrance_id: fragranceId, commit_id: commitId },
});
```

Confirm client-side via Stripe.js, then on batch met:

```ts
await stripe.paymentIntents.capture(paymentIntentId);
```

### Tech notes

- **Vite + React 19** instead of Next.js (the suggested stack). The scaffold was already Vite; for an MVP demo this ships faster and the code maps 1:1 to a Next.js `app/` migration later — only the routing shell needs swapping.
- **Tailwind v4** via `@tailwindcss/vite`, with brand tokens declared in `src/index.css` (`@theme` block).
- **Supabase**: anon-key reads/writes guarded by RLS. Server-side capture should use the service-role key.
- **Hash routing**: trivial single-page nav (`#/fragrance/<slug>`). Swap for `react-router` or Next.js `app/` when scaling.
