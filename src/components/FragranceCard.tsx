import { ArrowUpRight, Lock } from "lucide-react";
import type { Fragrance } from "../lib/types";
import BottlePhoto from "./BottlePhoto";
import BatchProgress from "./BatchProgress";
import { formatPrice } from "../lib/data";

type Props = {
  fragrance: Fragrance;
  vip: boolean;
  onOpen: () => void;
};

export default function FragranceCard({ fragrance, vip, onOpen }: Props) {
  const locked = !!fragrance.vipOnly && !vip;
  return (
    <button
      onClick={onOpen}
      className="group h-full w-full text-left bg-obsidian-soft border border-obsidian-line hover:border-gold/40 transition-all duration-300 flex flex-col"
    >
      {/* Bottle stage — width-driven aspect so the photo and the
          fragrance-name overlay stay pixel-aligned across all card sizes.
          Every card in a row has the same column width, so all stages
          have identical heights; auto-rows-fr on the grid then absorbs
          any content variance. */}
      <div className="relative w-full overflow-hidden bg-obsidian">
        <div className="transition-transform duration-500 group-hover:scale-[1.03]">
          <BottlePhoto
            fragrance={fragrance}
            crop="bottle"
            className="w-full"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 mix-blend-overlay transition-opacity duration-500 group-hover:opacity-70 pointer-events-none"
          style={{
            background: `radial-gradient(70% 60% at 50% 80%, ${fragrance.accent}33, transparent 70%)`,
          }}
        />

        {fragrance.vipOnly && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-obsidian/80 backdrop-blur-sm border border-gold/40 text-gold text-[10px] uppercase tracking-[0.22em] px-2 py-1">
            <Lock className="h-3 w-3" strokeWidth={1.4} /> VIP Early Access
          </span>
        )}

        {fragrance.committed >= fragrance.moq && (
          <span className="absolute top-3 right-3 inline-flex items-center bg-gold text-obsidian text-[10px] uppercase tracking-[0.22em] px-2 py-1 font-semibold">
            Batch Met
          </span>
        )}
      </div>

      {/* Content — uniform structure so all cards share the same row heights. */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3 min-h-[64px]">
          <div className="min-w-0">
            <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/40 truncate">
              {fragrance.inspiration}
            </div>
            <h3 className="mt-1 serif text-2xl text-cream group-hover:text-gold transition-colors truncate">
              {fragrance.name}
            </h3>
          </div>
          <ArrowUpRight
            className="h-4 w-4 text-cream/40 group-hover:text-gold transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 mt-1.5"
            strokeWidth={1.5}
          />
        </div>

        <p className="sans text-[13px] leading-relaxed text-cream/60 line-clamp-2 min-h-[40px]">
          {fragrance.tagline}
        </p>

        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.22em] text-cream/55 sans">
          <span className="text-gold font-semibold">{fragrance.oilPercent}% Extrait</span>
          <span className="h-3 w-px bg-obsidian-line" />
          <span>{fragrance.volumeMl} ml</span>
          <span className="h-3 w-px bg-obsidian-line" />
          <span>{formatPrice(fragrance.priceCents)}</span>
        </div>

        <div className="mt-auto pt-2">
          <BatchProgress fragrance={fragrance} compact />
        </div>

        <div
          className={`mt-1 sans text-[11px] uppercase tracking-[0.26em] ${
            locked ? "text-cream/40" : "text-gold"
          }`}
        >
          {locked ? "VIP Members Only" : "Commit to Batch →"}
        </div>
      </div>
    </button>
  );
}
