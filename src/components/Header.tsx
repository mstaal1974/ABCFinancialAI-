import { Crown, FlaskConical, LogOut, Menu, ShoppingBag, User as UserIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../lib/auth";

type Props = {
  commitCount: number;
  vip: boolean;
  user: AuthUser | null;
  onOpenCommits: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onNavigate: (target: "vault" | "education" | "vip" | "samples" | "home") => void;
};

export default function Header({
  commitCount,
  vip,
  user,
  onOpenCommits,
  onOpenAuth,
  onSignOut,
  onNavigate,
}: Props) {
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-obsidian/85 border-b border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate("home")}
          className="group flex items-center gap-2.5 shrink-0"
          aria-label="Maison Obsidian — home"
        >
          <FlaskConical className="h-5 w-5 text-gold" strokeWidth={1.4} />
          <span className="serif text-lg tracking-[0.28em] uppercase text-cream">
            Maison <span className="text-gold">Obsidian</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-7 sans text-[12px] uppercase tracking-[0.22em] text-cream/70">
          <button onClick={() => onNavigate("vault")} className="hover:text-gold transition-colors">
            The Vault
          </button>
          <button onClick={() => onNavigate("samples")} className="hover:text-gold transition-colors">
            Sample Box
          </button>
          <button onClick={() => onNavigate("education")} className="hover:text-gold transition-colors">
            The Method
          </button>
          <button onClick={() => onNavigate("vip")} className="hover:text-gold transition-colors flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5" strokeWidth={1.4} />
            VIP Club
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
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

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 border border-obsidian-line hover:border-gold/60 transition-colors h-9 pr-3 pl-1.5 text-[11px] uppercase tracking-[0.22em] text-cream/80"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-gold text-obsidian flex items-center justify-center text-[11px] font-semibold serif">
                    {initial}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[8rem] truncate">
                  {user.name ?? user.email ?? "Account"}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-obsidian border border-obsidian-line shadow-2xl">
                  <div className="px-4 py-3 border-b border-obsidian-line">
                    <div className="sans text-[10px] uppercase tracking-[0.24em] text-cream/40">
                      Signed in as
                    </div>
                    <div className="mt-1 sans text-[13px] text-cream truncate">
                      {user.email ?? user.name}
                    </div>
                    {user.provider !== "email" && (
                      <div className="mt-1 sans text-[10px] uppercase tracking-[0.22em] text-gold/80">
                        via {user.provider}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); onSignOut(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 sans text-[12px] uppercase tracking-[0.22em] text-cream/75 hover:bg-obsidian-soft hover:text-rust transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="hidden sm:inline-flex items-center gap-2 bg-gold text-obsidian h-9 px-4 text-[11px] uppercase tracking-[0.24em] hover:bg-gold-soft transition-colors"
            >
              <UserIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
              Sign In
            </button>
          )}

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
            <button onClick={() => { onNavigate("samples"); setMobile(false); }}>Sample Box</button>
            <button onClick={() => { onNavigate("education"); setMobile(false); }}>The Method</button>
            <button onClick={() => { onNavigate("vip"); setMobile(false); }}>VIP Club</button>
            {!user && (
              <button
                onClick={() => { onOpenAuth(); setMobile(false); }}
                className="mt-2 inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-10 text-[11px] uppercase tracking-[0.24em]"
              >
                <UserIcon className="h-3.5 w-3.5" strokeWidth={1.6} />
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
