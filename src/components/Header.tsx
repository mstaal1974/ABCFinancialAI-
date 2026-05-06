import { Crown, FlaskConical, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";

type Props = {
  commitCount: number;
  vip: boolean;
  onOpenCommits: () => void;
  onNavigate: (target: "vault" | "education" | "vip" | "home") => void;
};

export default function Header({ commitCount, vip, onOpenCommits, onNavigate }: Props) {
  const [mobile, setMobile] = useState(false);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-obsidian/85 border-b border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center justify-between">
        <button
          onClick={() => onNavigate("home")}
          className="group flex items-center gap-2.5"
          aria-label="Maison Obsidian — home"
        >
          <FlaskConical className="h-5 w-5 text-gold" strokeWidth={1.4} />
          <span className="serif text-lg tracking-[0.28em] uppercase text-cream">
            Maison <span className="text-gold">Obsidian</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-9 sans text-[12px] uppercase tracking-[0.22em] text-cream/70">
          <button onClick={() => onNavigate("vault")} className="hover:text-gold transition-colors">
            The Vault
          </button>
          <button onClick={() => onNavigate("education")} className="hover:text-gold transition-colors">
            The Method
          </button>
          <button onClick={() => onNavigate("vip")} className="hover:text-gold transition-colors flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5" strokeWidth={1.4} />
            VIP Club
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {vip && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 border border-gold/40 text-gold text-[10px] uppercase tracking-[0.2em]">
              <Crown className="h-3 w-3" strokeWidth={1.5} /> VIP
            </span>
          )}
          <button
            onClick={onOpenCommits}
            className="relative flex items-center gap-2 border border-obsidian-line hover:border-gold/60 transition-colors px-3 h-9 text-[11px] uppercase tracking-[0.22em] text-cream/80"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.4} />
            <span className="hidden sm:inline">Commits</span>
            {commitCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-gold text-obsidian text-[10px] font-semibold w-5 h-5 rounded-full flex items-center justify-center tabular-nums">
                {commitCount}
              </span>
            )}
          </button>
          <button
            className="md:hidden h-9 w-9 flex items-center justify-center border border-obsidian-line"
            onClick={() => setMobile((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobile && (
        <div className="md:hidden border-t border-obsidian-line bg-obsidian">
          <div className="px-6 py-4 flex flex-col gap-4 sans text-xs uppercase tracking-[0.22em] text-cream/80">
            <button onClick={() => { onNavigate("vault"); setMobile(false); }}>The Vault</button>
            <button onClick={() => { onNavigate("education"); setMobile(false); }}>The Method</button>
            <button onClick={() => { onNavigate("vip"); setMobile(false); }}>VIP Club</button>
          </div>
        </div>
      )}
    </header>
  );
}
