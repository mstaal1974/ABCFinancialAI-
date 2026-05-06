import { ArrowLeft, Check, Crown, CreditCard, Gift, Lock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Fragrance } from "../lib/types";
import { formatPrice } from "../lib/data";
import BottlePhoto from "./BottlePhoto";
import BatchProgress from "./BatchProgress";

type Props = {
  fragrance: Fragrance;
  vip: boolean;
  alreadyCommitted: boolean;
  giftBalanceCents: number;
  onBack: () => void;
  onCommit: (label: string | null) => Promise<void>;
};

const LABEL_MAX = 28;

export default function ProductDetail({
  fragrance,
  vip,
  alreadyCommitted,
  giftBalanceCents,
  onBack,
  onCommit,
}: Props) {
  const [label, setLabel] = useState("");
  const [labelEnabled, setLabelEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const locked = !!fragrance.vipOnly && !vip;
  const previewLabel = labelEnabled ? label : "";

  const giftApplied = Math.min(giftBalanceCents, fragrance.priceCents);
  const cardCharge = Math.max(0, fragrance.priceCents - giftApplied);

  const groupedNotes = useMemo(() => {
    const top = fragrance.notes.filter((n) => n.family === "top");
    const heart = fragrance.notes.filter((n) => n.family === "heart");
    const base = fragrance.notes.filter((n) => n.family === "base");
    return { top, heart, base };
  }, [fragrance.notes]);

  async function handleCommit() {
    if (locked || submitting || alreadyCommitted) return;
    setSubmitting(true);
    try {
      await onCommit(labelEnabled && label.trim() ? label.trim() : null);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-16">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 sans text-[11px] uppercase tracking-[0.28em] text-cream/60 hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to the Vault
        </button>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* LEFT — bottle preview */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 -z-10"
              style={{
                background: `radial-gradient(60% 50% at 50% 60%, ${fragrance.accent}22, transparent 65%)`,
              }}
            />
            <BottlePhoto
              fragrance={fragrance}
              customLabel={previewLabel}
              crop="bottle"
              className="w-full border border-obsidian-line"
            />
            <p className="mt-4 sans text-[10px] uppercase tracking-[0.28em] text-cream/40 text-center">
              Live Preview · Engraving updates as you type
            </p>
          </div>

          {/* RIGHT — details + commit */}
          <div>
            <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
              {fragrance.inspiration}
            </div>
            <h1 className="mt-3 serif text-5xl lg:text-6xl text-cream leading-[1.05]">
              {fragrance.name}
            </h1>
            <p className="mt-5 sans text-[15px] leading-relaxed text-cream/65 max-w-lg">
              {fragrance.story}
            </p>

            {/* Specs */}
            <dl className="mt-8 grid grid-cols-3 gap-px bg-obsidian-line border-y border-obsidian-line">
              {[
                { k: "Concentration", v: `${fragrance.oilPercent}% Extrait` },
                { k: "Volume", v: `${fragrance.volumeMl} ml` },
                { k: "Price", v: formatPrice(fragrance.priceCents) },
              ].map((s) => (
                <div key={s.k} className="bg-obsidian px-4 py-5">
                  <dt className="sans text-[10px] uppercase tracking-[0.24em] text-cream/45">
                    {s.k}
                  </dt>
                  <dd className="mt-1 serif text-xl text-gold">{s.v}</dd>
                </div>
              ))}
            </dl>

            {/* Notes */}
            <div className="mt-10">
              <div className="sans text-[10px] uppercase tracking-[0.32em] text-cream/50 mb-4">
                Composition
              </div>
              {(["top", "heart", "base"] as const).map((g) => (
                <div key={g} className="grid grid-cols-[80px_1fr] gap-4 py-3 border-t border-obsidian-line first:border-t-0">
                  <div className="serif italic text-cream/60 capitalize text-sm">{g} notes</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 sans text-[13px] text-cream">
                    {groupedNotes[g].map((n, i) => (
                      <span key={n.name} className="flex items-center gap-3">
                        {n.name}
                        {i < groupedNotes[g].length - 1 && (
                          <span className="text-gold/50" aria-hidden>
                            ·
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Label Engine */}
            <div className="mt-10 border border-obsidian-line bg-obsidian-soft/40 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-gold">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
                    <span className="sans text-[10px] uppercase tracking-[0.28em]">
                      Custom Label Engine
                    </span>
                  </div>
                  <h3 className="mt-2 serif text-xl text-cream">
                    Engrave a name, a date, a secret.
                  </h3>
                  <p className="mt-1 sans text-[13px] text-cream/55">
                    Hand-set onto the bottle's label panel. Up to {LABEL_MAX} characters.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={labelEnabled}
                    onChange={(e) => setLabelEnabled(e.target.checked)}
                  />
                  <span className="relative w-9 h-5 bg-obsidian-line peer-checked:bg-gold transition-colors">
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-cream peer-checked:translate-x-4 transition-transform" />
                  </span>
                  <span className="sans text-[11px] uppercase tracking-[0.22em] text-cream/70">
                    {labelEnabled ? "On" : "Off"}
                  </span>
                </label>
              </div>

              <div className="mt-5">
                <input
                  type="text"
                  value={label}
                  maxLength={LABEL_MAX}
                  onChange={(e) => setLabel(e.target.value)}
                  onFocus={() => setLabelEnabled(true)}
                  placeholder='e.g. "Happy Birthday, John"'
                  className="w-full bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-3 text-cream sans placeholder:text-cream/30 text-base transition-colors"
                />
                <div className="mt-2 flex items-center justify-between sans text-[10px] uppercase tracking-[0.24em] text-cream/45">
                  <span>{labelEnabled ? "Preview is live →" : "Toggle on to engrave"}</span>
                  <span className="tabular-nums">
                    {label.length} / {LABEL_MAX}
                  </span>
                </div>
              </div>
            </div>

            {/* Batch + commit CTA */}
            <div className="mt-10">
              <BatchProgress fragrance={fragrance} />

              {giftApplied > 0 && !alreadyCommitted && !done && (
                <div className="mt-6 border border-gold/40 bg-gold/5 p-4 flex items-start gap-3">
                  <Gift className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
                  <div className="flex-1">
                    <div className="sans text-[10px] uppercase tracking-[0.26em] text-gold/90">
                      Gift credit applied
                    </div>
                    <div className="mt-1 sans text-[13px] text-cream/80">
                      <span className="text-gold tabular-nums">
                        {formatPrice(giftApplied)}
                      </span>{" "}
                      from your wallet ·{" "}
                      {cardCharge > 0 ? (
                        <>
                          your card holds{" "}
                          <span className="text-cream tabular-nums">
                            {formatPrice(cardCharge)}
                          </span>
                        </>
                      ) : (
                        <span className="text-cream">no card hold needed</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-3">
                <button
                  onClick={handleCommit}
                  disabled={locked || submitting || alreadyCommitted || done}
                  className="group w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-14 sans text-xs uppercase tracking-[0.32em] hover:bg-gold-soft disabled:bg-obsidian-line disabled:text-cream/40 transition-colors"
                >
                  {locked ? (
                    <>
                      <Lock className="h-4 w-4" strokeWidth={1.6} />
                      VIP Members Only
                    </>
                  ) : done || alreadyCommitted ? (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Committed — payment authorized
                    </>
                  ) : submitting ? (
                    <>Authorizing card…</>
                  ) : cardCharge === 0 && giftApplied > 0 ? (
                    <>
                      <Gift className="h-4 w-4" strokeWidth={1.6} />
                      Commit with Gift Credit · {formatPrice(giftApplied)}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" strokeWidth={1.6} />
                      Commit to this Batch ·{" "}
                      {giftApplied > 0
                        ? `${formatPrice(cardCharge)} + ${formatPrice(giftApplied)} gift`
                        : formatPrice(fragrance.priceCents)}
                    </>
                  )}
                </button>
                <p className="sans text-[11px] text-cream/50 leading-relaxed">
                  Your card is <span className="text-gold">authorized, never charged</span>{" "}
                  today. We capture only when the batch reaches{" "}
                  <span className="text-cream">{fragrance.moq} commits</span>. If the
                  batch closes short, the hold is released — no questions asked.
                </p>
                {locked && (
                  <p className="sans text-[11px] text-gold/80 inline-flex items-center gap-2">
                    <Crown className="h-3 w-3" strokeWidth={1.6} />
                    Join the VIP Club below for early access to this batch.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
