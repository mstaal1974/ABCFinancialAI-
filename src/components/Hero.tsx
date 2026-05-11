import { ArrowRight, Beaker } from "lucide-react";

type Props = { onEnterVault: () => void };

export default function Hero({ onEnterVault }: Props) {
  return (
    <section className="relative overflow-hidden">
      {/* Atmospheric glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(201,169,97,0.10), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-20 pb-28 lg:pt-28 lg:pb-36 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/30 text-gold text-[10px] uppercase tracking-[0.32em] sans">
          <Beaker className="h-3 w-3" strokeWidth={1.4} />
          Boutique Laboratory · Est. 2026
        </div>

        <h1 className="mt-8 serif font-light text-[44px] sm:text-6xl lg:text-7xl leading-[1.05] text-cream">
          Fragrance, distilled by
          <br />
          <span className="italic text-gold">small numbers.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl sans text-[15px] leading-relaxed text-cream/65">
          We pour each scent in batches of twenty. Thirty percent oil
          concentration. Dubai-sourced absolutes. Macerated four full weeks.
          You don't pay until your batch is met — then your card is captured,
          the lab opens, and your bottle ships engraved with your name.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onEnterVault}
            className="group inline-flex items-center gap-2 bg-gold hover:bg-gold-soft text-obsidian px-7 h-11 sans text-xs uppercase tracking-[0.28em] transition-colors"
          >
            Enter the Vault
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.6} />
          </button>
          <a
            href="#method"
            className="sans text-xs uppercase tracking-[0.28em] text-cream/70 hover:text-gold border-b border-cream/20 hover:border-gold pb-1 transition-colors"
          >
            The Method
          </a>
        </div>

        {/* Pillars */}
        <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-px bg-obsidian-line">
          {[
            { kpi: "30%", label: "Oil concentration" },
            { kpi: "4 wks", label: "Maceration period" },
            { kpi: "20", label: "Bottles per batch" },
            { kpi: "DXB", label: "Sourced in Dubai" },
          ].map((p) => (
            <div key={p.label} className="bg-obsidian px-4 py-7">
              <div className="serif text-3xl text-gold">{p.kpi}</div>
              <div className="mt-1 sans text-[10px] uppercase tracking-[0.28em] text-cream/55">
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
