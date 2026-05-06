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
│   ├── Header.tsx                Sticky nav · sign in / user menu / commits
│   ├── Hero.tsx                  Atmospheric landing + 4 brand pillars
│   ├── Vault.tsx                 Catalogue grid w/ All / Men's / Women's tabs
│   ├── FragranceCard.tsx         Card with bottle preview + batch progress
│   ├── BatchProgress.tsx         "12/20 spots filled" bar w/ shimmer
│   ├── ProductDetail.tsx         Full PDP + Custom Label Engine + commit CTA
│   ├── Bottle.tsx                SVG 2D bottle mockup w/ live engraving
│   ├── SampleBox.tsx             Pick 5 vials → flat-fee discovery box
│   ├── GiftSection.tsx           Buy a gift card by value, share via link
│   ├── GiftRedeem.tsx            #/gift/<code> redemption screen
│   ├── Education.tsx             "The Method" — 4 brand pillars
│   ├── VIPClub.tsx               Subscription tier — early-access perks
│   ├── CommitDrawer.tsx          Slide-out cart of authorized commits
│   ├── AuthModal.tsx             Sign in / sign up · email + Google OAuth
│   └── Footer.tsx
└── lib/
    ├── types.ts                  Domain types (Fragrance, Gender, Commit…)
    ├── data.ts                   Seed catalogue (mirrors SQL seed)
    ├── store.ts                  React hooks: useFragrances(), useVIP()
    ├── auth.ts                   useAuth() — Supabase Auth w/ demo fallback
    ├── gifts.ts                  useGifts() — purchase / redeem / apply balance
    ├── supabase.ts               Supabase client (null-safe)
    └── stripe.ts                 Authorize-now / capture-later stub
supabase/
└── migrations/
    ├── 0001_init.sql             Fragrances, commits, samples, subscribers
    └── 0002_gifts.sql            Gift cards + claim RPC + order split cols
```

### Auth (email + Google)

`src/lib/auth.ts` wraps Supabase Auth (`signInWithPassword`, `signUp`,
`signInWithOAuth({ provider: "google" })`). The `<AuthModal>` exposes both
flows. To enable Google sign-in:

1. In your Supabase project: **Authentication → Providers → Google → Enable**.
2. Paste a Google OAuth client ID / secret (created in the Google Cloud
   Console with `https://<project>.supabase.co/auth/v1/callback` as an
   authorized redirect URI).
3. Add `http://localhost:5173` (and the production origin) to the
   **Redirect URLs** allowlist.

When Supabase auth is unreachable, the modal falls back to a local
"demo user" so the UX flow is testable end-to-end. Demo users are not
written to the `commits.user_id` column (it's nullable for that reason).

### Collections (Men's / Women's)

Each fragrance carries a `gender: "masculine" | "feminine" | "unisex"`
field. The Vault has tabs:

- **All Fragrances** — everything
- **For Him** — `masculine` + `unisex`
- **For Her** — `feminine` + `unisex`

Unisex scents intentionally appear in both gendered tabs.

### Sample Box

`<SampleBox>` lets the customer pick exactly **5** fragrances at a flat
$35 (`SAMPLE_BOX_PRICE_CENTS`). The selection grid disables further
choices once five are picked, and the order requires sign-in. Submitted
orders are written to `public.sample_box_orders` (an array column of
fragrance ids — see migration). Stripe wiring uses the same authorize-now
stub as commits.

### Send a Gift

`<GiftSection>` lets a signed-in user purchase a gift card by **value**,
not by bottle. Flow:

1. Sender picks a preset ($35 / $185 / $225 / $500) or a custom amount
   ($20–$2,000), enters recipient name + email, optional message and
   delivery date.
2. On purchase, a unique code (`MO-XXXX-XXXX`) is generated and the row
   is inserted into `public.gift_cards`.
3. The sender gets a confirmation card with the code + a shareable link
   `/#/gift/<CODE>` (copy-to-clipboard).
4. The recipient lands on the redemption screen (`<GiftRedeem>`),
   signs in or signs up, and clicks "Add to my Wallet" — the card is
   moved from `active` → `redeemed`.
5. Their balance is shown as a chip in the header. At commit / sample
   box checkout, gift credit is **applied first** and only the remainder
   needs Stripe authorization (see `useGifts.applyBalance`). The
   `commits` and `sample_box_orders` tables now have `gift_cents` and
   `charge_cents` columns recording the split per order.

Notes for production:

- Gift purchases should run through a server route that creates a
  Stripe charge **with immediate capture** (gift cards are non-refundable
  digital goods, unlike batch commits) before inserting the row with the
  service-role key.
- Recipient email delivery is currently mocked (the confirmation card
  shows the code/link). Wire to Resend / Postmark / SendGrid via a
  scheduled job that respects `scheduled_for`.
- The `claim_gift_card(code, email)` SQL function in
  `0002_gifts.sql` is provided as a `security definer` helper so a
  client can call it via Supabase RPC and avoid handing out generic
  update privileges.

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
