import { FlaskConical } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-obsidian border-t border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-5 w-5 text-gold" strokeWidth={1.4} />
              <span className="serif text-lg tracking-[0.28em] uppercase text-cream">
                Maison
              </span>
            </div>
            <p className="mt-4 sans text-[13px] text-cream/50 max-w-xs leading-relaxed">
              A boutique laboratory pouring 30% Extrait de Parfum in batches of
              twenty. Sourced in Dubai. Macerated four weeks. Shipped engraved.
            </p>
          </div>

          {[
            {
              h: "Atelier",
              items: ["The Vault", "The Method", "VIP Club", "Custom Commissions"],
            },
            {
              h: "Trade",
              items: ["Shipping", "Returns & Holds", "Care for Extrait", "Press"],
            },
            {
              h: "Contact",
              items: ["atelier@maison-obsidian.com", "DXB · NYC · LDN", "Mon–Fri, 09–18 GST"],
            },
          ].map((col) => (
            <div key={col.h}>
              <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
                {col.h}
              </div>
              <ul className="mt-4 space-y-2 sans text-[13px] text-cream/65">
                {col.items.map((it) => (
                  <li key={it}>
                    <span className="hover:text-gold transition-colors cursor-default">
                      {it}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-obsidian-line flex flex-col sm:flex-row items-center justify-between gap-4 sans text-[11px] uppercase tracking-[0.24em] text-cream/40">
          <span>© {new Date().getFullYear()} Maison Obsidian — Pour No. 001</span>
          <span>Crafted as a single-batch MVP · Demo build</span>
        </div>
      </div>
    </footer>
  );
}
