/**
 * Stripe "authorize now, capture later" — client-side stub.
 *
 * In production this calls a server route (e.g. Next.js /api/checkout) that:
 *   1. Creates a PaymentIntent with `capture_method: "manual"` and
 *      `amount = price_cents`.
 *   2. Confirms the intent client-side via Stripe.js to put a hold on the
 *      customer's card.
 *   3. Stores the PI id alongside the commit row in Supabase.
 *
 * When the batch reaches MOQ, an admin webhook (or scheduled job) calls
 *   stripe.paymentIntents.capture(pi_id)
 * for every commit on that fragrance, and notifies the admin.
 *
 * For this MVP demo we return a fake intent id so the UX flow works
 * end-to-end without billing anyone real money.
 */
export async function authorizePayment(opts: {
  fragranceId: string;
  amountCents: number;
}): Promise<{ paymentIntentId: string; status: "authorized" }> {
  await new Promise((r) => setTimeout(r, 650)); // simulate network
  return {
    paymentIntentId: `pi_stub_${opts.fragranceId}_${Math.random()
      .toString(36)
      .slice(2, 10)}`,
    status: "authorized",
  };
}

export async function notifyAdminBatchClosed(opts: {
  fragranceId: string;
  fragranceName: string;
  count: number;
}) {
  // In production: POST to an admin webhook (Slack/Email/SMS) via server route.
  console.info(
    `%c[ADMIN] Batch met for ${opts.fragranceName} — ${opts.count} commits ready to capture`,
    "color:#c9a961;font-weight:600",
  );
}
