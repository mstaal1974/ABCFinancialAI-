import type { Fragrance } from "../lib/types";
import { daysUntil } from "../lib/data";

type Props = { fragrance: Fragrance; compact?: boolean };

export default function BatchProgress({ fragrance, compact }: Props) {
  const pct = Math.min(100, Math.round((fragrance.committed / fragrance.moq) * 100));
  const met = fragrance.committed >= fragrance.moq;
  const days = daysUntil(fragrance.batchClosesAt);

  return (
    <div className="w-full">
      <div className={`flex items-baseline justify-between ${compact ? "text-[11px]" : "text-xs"} sans tracking-wider uppercase text-cream/60`}>
        <span>
          <span className="text-gold font-semibold tabular-nums">{fragrance.committed}</span>
          <span className="text-cream/40"> / {fragrance.moq} spots filled</span>
        </span>
        <span className="tabular-nums">
          {met ? "Batch Met" : days === 0 ? "Closes Today" : `${days}d left`}
        </span>
      </div>
      <div className={`mt-2 relative h-[3px] w-full bg-obsidian-line overflow-hidden`}>
        <div
          className="absolute inset-y-0 left-0 bg-gold transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {!met && pct > 0 && (
          <div
            className="absolute inset-y-0 shimmer"
            style={{ left: 0, width: `${pct}%` }}
            aria-hidden
          />
        )}
      </div>
      {met && !compact && (
        <p className="mt-2 text-[11px] sans uppercase tracking-[0.2em] text-gold">
          Threshold reached — capturing payments
        </p>
      )}
    </div>
  );
}
