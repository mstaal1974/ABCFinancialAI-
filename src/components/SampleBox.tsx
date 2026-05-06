import { Check, Gift, Loader2, Lock, Package, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuthUser } from "../lib/auth";
import { SAMPLE_BOX_PRICE_CENTS, SAMPLE_BOX_SIZE, formatPrice } from "../lib/data";
import { isSupabaseEnabled, supabase } from "../lib/supabase";
import type { Fragrance } from "../lib/types";

type Props = {
  fragrances: Fragrance[];
  user: AuthUser | null;
  giftBalanceCents: number;
  onApplyGift: (amountCents: number) => Promise<{ giftCents: number; chargeCents: number }>;
  onRequireAuth: () => void;
};

export default function SampleBox({
  fragrances,
  user,
  giftBalanceCents,
  onApplyGift,
  onRequireAuth,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = SAMPLE_BOX_SIZE;
  const remaining = max - selected.size;
  const ready = selected.size === max;

  const giftApplied = Math.min(giftBalanceCents, SAMPLE_BOX_PRICE_CENTS);
  const cardCharge = Math.max(0, SAMPLE_BOX_PRICE_CENTS - giftApplied);

  const visible = useMemo(() => fragrances, [fragrances]);
  const selectedFragrances = useMemo(
    () => fragrances.filter((f) => selected.has(f.id)),
    [fragrances, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < max) {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!ready) return;
    setSubmitting(true);
    try {
      // Spend gift credit first; only the remainder hits the buyer's card.
      const split = await onApplyGift(SAMPLE_BOX_PRICE_CENTS);
      if (isSupabaseEnabled && supabase) {
        try {
          await supabase.from("sample_box_orders").insert({
            user_id: user.id.startsWith("demo-") ? null : user.id,
            user_email: user.email,
            fragrance_ids: Array.from(selected),
            price_cents: SAMPLE_BOX_PRICE_CENTS,
            gift_cents: split.giftCents,
            charge_cents: split.chargeCents,
            status: "authorized",
          });
        } catch {
          /* best effort — demo flow continues */
        }
      }
      // Simulate the Stripe authorize call.
      await new Promise((r) => setTimeout(r, 700));
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place sample box.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="samples" className="relative bg-obsidian-soft/40 border-y border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-14 items-start">
          {/* LEFT — pitch + summary */}
          <div className="lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 text-gold text-[10px] uppercase tracking-[0.32em] sans">
              <Package className="h-3 w-3" strokeWidth={1.4} />
              The Discovery Set
            </div>
            <h2 className="mt-6 serif text-4xl lg:text-5xl leading-[1.05] text-cream">
              Choose <span className="italic text-gold">five</span>.<br />
              We'll ship a flight of vials.
            </h2>
            <p className="mt-5 sans text-[15px] text-cream/65 leading-relaxed max-w-md">
              Every Sample Box is hand-decanted from the same 30% Extrait pour
              that fills the full bottles. 2 ml × 5 vials, layered in a black
              linen sleeve with a tasting card.
            </p>

            <div className="mt-8 bg-obsidian border border-obsidian-line p-6">
              <div className="flex items-baseline justify-between">
                <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                  Sample Box · {SAMPLE_BOX_SIZE} vials
                </span>
                <span className="serif text-3xl text-gold tabular-nums">
                  {formatPrice(SAMPLE_BOX_PRICE_CENTS)}
                </span>
              </div>
              <p className="mt-2 sans text-[12px] text-cream/55">
                Credit applied toward your first full-bottle commit.
              </p>

              <div className="mt-5 space-y-3 sans text-[13px] text-cream/75">
                {[
                  "2 ml × 5 vials — same juice as the full pour",
                  "Tasting card with the perfumer's notes",
                  "Ships in 5–7 days, anywhere",
                  "Credit redeemable on any open batch",
                ].map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selection summary */}
            <div className="mt-6 border border-obsidian-line bg-obsidian/60 p-5">
              <div className="flex items-baseline justify-between">
                <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                  Your selection
                </span>
                <span className="serif text-xl text-gold tabular-nums">
                  {selected.size} / {max}
                </span>
              </div>

              {selectedFragrances.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {selectedFragrances.map((f, i) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-3 sans text-[13px] text-cream"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="serif text-gold tabular-nums w-5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{f.name}</span>
                      </span>
                      <button
                        onClick={() => toggle(f.id)}
                        className="sans text-[10px] uppercase tracking-[0.22em] text-cream/40 hover:text-rust"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 sans text-[12px] text-cream/45 italic">
                  Pick five from the grid →
                </p>
              )}

              {giftApplied > 0 && !done && (
                <div className="mt-5 border border-gold/40 bg-gold/5 p-3 flex items-start gap-2 sans text-[12px] text-cream/75">
                  <Gift className="h-3.5 w-3.5 text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
                  <span>
                    <span className="text-gold tabular-nums">
                      {formatPrice(giftApplied)}
                    </span>{" "}
                    gift credit applied ·{" "}
                    {cardCharge > 0
                      ? `card holds ${formatPrice(cardCharge)}`
                      : "no card hold needed"}
                  </span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!ready || submitting || done}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.28em] hover:bg-gold-soft disabled:bg-obsidian-line disabled:text-cream/40 transition-colors"
              >
                {!user ? (
                  <>
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />
                    Sign in to Order
                  </>
                ) : done ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={1.8} />
                    Sample Box on its way
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                    Placing order…
                  </>
                ) : ready ? (
                  <>
                    {cardCharge === 0 && giftApplied > 0 ? (
                      <Gift className="h-3.5 w-3.5" strokeWidth={1.6} />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
                    )}
                    Order Sample Box ·{" "}
                    {giftApplied > 0
                      ? cardCharge === 0
                        ? `${formatPrice(giftApplied)} gift`
                        : `${formatPrice(cardCharge)} + ${formatPrice(giftApplied)} gift`
                      : formatPrice(SAMPLE_BOX_PRICE_CENTS)}
                  </>
                ) : (
                  <>Pick {remaining} more {remaining === 1 ? "fragrance" : "fragrances"}</>
                )}
              </button>
              {error && (
                <p className="mt-3 sans text-[11px] text-rust">{error}</p>
              )}
              {done && (
                <p className="mt-3 sans text-[11px] text-cream/55 leading-relaxed">
                  Thank you. We'll send a tracking number to{" "}
                  <span className="text-gold">{user?.email ?? "your inbox"}</span>{" "}
                  once the vials are sleeved.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — selectable fragrance grid */}
          <div>
            <div className="flex items-center justify-between mb-4 sans text-[10px] uppercase tracking-[0.26em] text-cream/45">
              <span>Choose any five</span>
              <span className="tabular-nums">{visible.length} fragrances</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-obsidian-line">
              {visible.map((f) => {
                const isSel = selected.has(f.id);
                const disabled = !isSel && selected.size >= max;
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    disabled={disabled}
                    aria-pressed={isSel}
                    className={`relative text-left bg-obsidian p-5 transition-colors ${
                      isSel
                        ? "ring-1 ring-gold bg-obsidian-soft"
                        : disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-obsidian-soft"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-14 shrink-0 border border-obsidian-line"
                        style={{
                          background: `linear-gradient(180deg, ${f.glassTint}, #050507)`,
                        }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div className="sans text-[10px] uppercase tracking-[0.24em] text-cream/40 truncate">
                          {f.inspiration}
                        </div>
                        <div className="mt-0.5 serif text-lg text-cream truncate">
                          {f.name}
                        </div>
                        <div className="mt-1 sans text-[12px] text-cream/55 line-clamp-1">
                          {f.tagline}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2 sans text-[10px] uppercase tracking-[0.22em] text-cream/45">
                          <span className="text-gold/80 capitalize">{f.gender}</span>
                          <span className="h-2.5 w-px bg-obsidian-line" />
                          <span>{f.oilPercent}% Extrait</span>
                        </div>
                      </div>
                      <div
                        className={`h-6 w-6 shrink-0 border flex items-center justify-center transition-colors ${
                          isSel
                            ? "bg-gold border-gold text-obsidian"
                            : "border-obsidian-line text-transparent"
                        }`}
                        aria-hidden
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
