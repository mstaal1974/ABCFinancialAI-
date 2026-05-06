import { useMemo, useState } from "react";
import type { Fragrance, Gender } from "../lib/types";
import FragranceCard from "./FragranceCard";

type Filter = "all" | "men" | "women";

type Props = {
  fragrances: Fragrance[];
  vip: boolean;
  onOpen: (slug: string) => void;
};

const TABS: { id: Filter; label: string; eyebrow: string }[] = [
  { id: "all", label: "All Fragrances", eyebrow: "Full Collection" },
  { id: "men", label: "For Him", eyebrow: "Men's" },
  { id: "women", label: "For Her", eyebrow: "Women's" },
];

function matches(f: Fragrance, filter: Filter): boolean {
  if (filter === "all") return true;
  const g: Gender = f.gender;
  if (filter === "men") return g === "masculine" || g === "unisex";
  return g === "feminine" || g === "unisex";
}

export default function Vault({ fragrances, vip, onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => fragrances.filter((f) => matches(f, filter)),
    [fragrances, filter],
  );

  const counts = useMemo(
    () => ({
      all: fragrances.length,
      men: fragrances.filter((f) => matches(f, "men")).length,
      women: fragrances.filter((f) => matches(f, "women")).length,
    }),
    [fragrances],
  );

  return (
    <section id="vault" className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-20 lg:py-28">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 border-b border-obsidian-line pb-8">
          <div>
            <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
              The Vault — Current Pour
            </div>
            <h2 className="mt-3 serif text-4xl lg:text-5xl text-cream">
              Open batches, <span className="italic text-gold/90">awaiting commits.</span>
            </h2>
          </div>
          <p className="hidden md:block max-w-sm sans text-[13px] text-cream/55 leading-relaxed">
            Each fragrance below is poured only when its batch reaches the
            commit threshold. Your card is held — never charged — until then.
          </p>
        </div>

        {/* Gender tabs */}
        <div
          role="tablist"
          aria-label="Filter by collection"
          className="mb-10 flex flex-wrap items-center gap-px bg-obsidian-line border border-obsidian-line"
        >
          {TABS.map((t) => {
            const active = filter === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(t.id)}
                className={`group flex-1 sm:flex-none px-6 py-4 text-left transition-colors ${
                  active
                    ? "bg-gold text-obsidian"
                    : "bg-obsidian text-cream/70 hover:text-gold hover:bg-obsidian-soft"
                }`}
              >
                <div className="sans text-[10px] uppercase tracking-[0.28em] opacity-80">
                  {t.eyebrow}
                </div>
                <div className="mt-1 flex items-baseline gap-2 serif text-xl">
                  {t.label}
                  <span
                    className={`sans text-[11px] tabular-nums ${
                      active ? "text-obsidian/60" : "text-cream/40"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="py-24 text-center sans text-[13px] text-cream/55">
            No fragrances in this collection yet — check back next pour.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-obsidian-line auto-rows-fr">
            {visible.map((f) => (
              <div key={f.id} className="bg-obsidian flex">
                <FragranceCard fragrance={f} vip={vip} onOpen={() => onOpen(f.slug)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
