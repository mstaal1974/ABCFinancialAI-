import { Trash2, X } from "lucide-react";
import type { Commit, Fragrance } from "../lib/types";
import { formatPrice } from "../lib/data";

type Props = {
  open: boolean;
  onClose: () => void;
  commits: Commit[];
  fragrances: Fragrance[];
  onRelease: (id: string) => void;
};

export default function CommitDrawer({ open, onClose, commits, fragrances, onRelease }: Props) {
  const lookup = (id: string) => fragrances.find((f) => f.id === id);
  const total = commits.reduce((sum, c) => {
    const f = lookup(c.fragranceId);
    return sum + (f?.priceCents ?? 0);
  }, 0);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
      />
      <aside
        className={`absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-obsidian border-l border-obsidian-line flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 h-16 border-b border-obsidian-line">
          <div>
            <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
              Your Commits
            </div>
            <div className="serif text-xl text-cream">Holding {commits.length} {commits.length === 1 ? "spot" : "spots"}</div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center border border-obsidian-line hover:border-gold/40 transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {commits.length === 0 ? (
            <div className="p-10 text-center">
              <p className="sans text-[13px] text-cream/55 leading-relaxed">
                You haven't committed to any batches yet.
                <br />
                <span className="text-cream/35">Open the Vault to begin.</span>
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-obsidian-line">
              {commits.map((c) => {
                const f = lookup(c.fragranceId);
                if (!f) return null;
                return (
                  <li key={c.id} className="px-6 py-5 flex gap-4">
                    <div
                      className="w-12 h-16 shrink-0 border border-obsidian-line"
                      style={{
                        background: `linear-gradient(180deg, ${f.glassTint}, #050507)`,
                      }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="serif text-base text-cream truncate">{f.name}</div>
                          <div className="sans text-[10px] uppercase tracking-[0.22em] text-cream/40">
                            {f.committed}/{f.moq} spots · {f.oilPercent}% Extrait
                          </div>
                        </div>
                        <div className="serif text-base text-gold tabular-nums">
                          {formatPrice(f.priceCents)}
                        </div>
                      </div>
                      {c.customLabel && (
                        <div className="mt-2 sans text-[12px] text-cream/65 italic">
                          “{c.customLabel}”
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between sans text-[10px] uppercase tracking-[0.22em] text-cream/40">
                        <span className="text-gold/80">Authorized · awaiting batch</span>
                        <button
                          onClick={() => onRelease(c.id)}
                          className="inline-flex items-center gap-1 hover:text-rust transition-colors"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                          Release
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {commits.length > 0 && (
          <footer className="border-t border-obsidian-line p-6 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                Total to be captured
              </span>
              <span className="serif text-2xl text-gold tabular-nums">
                {formatPrice(total)}
              </span>
            </div>
            <p className="sans text-[11px] text-cream/50 leading-relaxed">
              Card holds are released automatically if any batch closes short.
              You'll only ever be charged for fragrances whose batches reach
              their MOQ.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-obsidian-soft border border-obsidian-line text-cream h-11 sans text-[11px] uppercase tracking-[0.28em] hover:border-gold/50 transition-colors"
            >
              Continue Browsing the Vault
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
