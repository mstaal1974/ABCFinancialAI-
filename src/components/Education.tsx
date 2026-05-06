import { Beaker, Droplets, MapPin, Timer } from "lucide-react";

const PILLARS = [
  {
    icon: Droplets,
    eyebrow: "Concentration",
    title: "30% Extrait de Parfum",
    body:
      "Most designer fragrances pour 8–15% oil, leaving alcohol to evaporate within an hour. We pour 30% — the legal ceiling for an extrait — so the scent sits on skin like a varnish. One spray lasts a day; two lasts a date.",
    fact: "vs. industry avg. 12%",
  },
  {
    icon: MapPin,
    eyebrow: "Sourcing",
    title: "Distilled in Dubai",
    body:
      "Our oils are sourced from a single perfumery district in Deira where attar makers have refined oud, saffron and rose absolute for three generations. Every shipment is GC/MS-tested for purity before it touches a bottle.",
    fact: "DXB · 25.276°N",
  },
  {
    icon: Timer,
    eyebrow: "Maceration",
    title: "Four-week Rest",
    body:
      "After we blend, the juice rests in opaque glass for 28 days at 17°C. The molecules marry; the alcohol dies down. A fresh blend smells sharp and chemical — a macerated one smells whole. We refuse to ship anything younger.",
    fact: "28 days, 17°C",
  },
  {
    icon: Beaker,
    eyebrow: "Method",
    title: "Boutique Laboratory",
    body:
      "We pour twenty bottles at a time. No warehouses, no resellers, no aging stock under fluorescent light. Every bottle in your hand was filled, capped and labelled in the same week — by the same two hands.",
    fact: "20 bottles per batch",
  },
];

export default function Education() {
  return (
    <section id="method" className="relative bg-obsidian-soft/40 border-y border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24 lg:py-32">
        <div className="max-w-2xl">
          <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
            The Method
          </div>
          <h2 className="mt-3 serif text-4xl lg:text-5xl text-cream leading-tight">
            What separates a <span className="italic text-gold/90">boutique laboratory</span>{" "}
            from a fragrance factory.
          </h2>
          <p className="mt-5 sans text-[15px] text-cream/65 leading-relaxed">
            We chose four constraints — concentration, sourcing, maceration, batch
            size — and refuse to compromise on any of them. Below: how each one
            changes what arrives at your door.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-px bg-obsidian-line">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.title}
                className="bg-obsidian p-8 lg:p-10 group hover:bg-obsidian-soft/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-6 mb-6">
                  <Icon className="h-6 w-6 text-gold" strokeWidth={1.3} />
                  <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/40">
                    {p.fact}
                  </span>
                </div>
                <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/70">
                  {p.eyebrow}
                </div>
                <h3 className="mt-2 serif text-2xl text-cream">{p.title}</h3>
                <p className="mt-4 sans text-[14px] text-cream/65 leading-relaxed">{p.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
