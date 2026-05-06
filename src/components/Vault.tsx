import type { Fragrance } from "../lib/types";
import FragranceCard from "./FragranceCard";

type Props = {
  fragrances: Fragrance[];
  vip: boolean;
  onOpen: (slug: string) => void;
};

export default function Vault({ fragrances, vip, onOpen }: Props) {
  return (
    <section id="vault" className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-20 lg:py-28">
        <div className="flex items-end justify-between gap-6 mb-12 border-b border-obsidian-line pb-6">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-obsidian-line">
          {fragrances.map((f) => (
            <div key={f.id} className="bg-obsidian">
              <FragranceCard fragrance={f} vip={vip} onOpen={() => onOpen(f.slug)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
