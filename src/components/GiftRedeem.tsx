import { ArrowLeft, ArrowRight, Check, Gift, Loader2, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../lib/auth";
import { formatPrice } from "../lib/data";
import type { GiftCard } from "../lib/types";

type Props = {
  code: string;
  user: AuthUser | null;
  onLookup: (code: string) => Promise<GiftCard | null>;
  onRedeem: (code: string) => Promise<{ ok: true; card: GiftCard } | { ok: false; error: string }>;
  onRequireAuth: (reason?: string) => void;
  onBack: () => void;
  onEnterVault: () => void;
};

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; card: GiftCard }
  | { kind: "redeeming"; card: GiftCard }
  | { kind: "redeemed"; card: GiftCard }
  | { kind: "error"; error: string; card?: GiftCard };

export default function GiftRedeem({
  code,
  user,
  onLookup,
  onRedeem,
  onRequireAuth,
  onBack,
  onEnterVault,
}: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const card = await onLookup(code);
      if (cancelled) return;
      setState(card ? { kind: "ready", card } : { kind: "missing" });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, onLookup]);

  async function handleRedeem() {
    if (state.kind !== "ready") return;
    if (!user) {
      onRequireAuth("Sign in or create an account to claim this gift.");
      return;
    }
    setState({ kind: "redeeming", card: state.card });
    const result = await onRedeem(code);
    if (result.ok) {
      setState({ kind: "redeemed", card: result.card });
    } else {
      setState({ kind: "error", error: result.error, card: state.card });
    }
  }

  return (
    <section className="relative">
      <div className="mx-auto max-w-3xl px-6 lg:px-10 py-16 lg:py-24">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 sans text-[11px] uppercase tracking-[0.28em] text-cream/60 hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to the Vault
        </button>

        <div className="mt-10 relative">
          <div
            aria-hidden
            className="absolute -inset-px"
            style={{
              background:
                "linear-gradient(135deg, rgba(201,169,97,0.55), transparent 45%, rgba(201,169,97,0.2) 100%)",
            }}
          />
          <div className="relative bg-obsidian-soft border border-gold/30 p-10 lg:p-14">
            {state.kind === "loading" && (
              <div className="flex flex-col items-center py-10 text-cream/60">
                <Loader2 className="h-6 w-6 animate-spin text-gold" strokeWidth={1.6} />
                <p className="mt-4 sans text-[12px] uppercase tracking-[0.28em]">
                  Looking up your gift…
                </p>
              </div>
            )}

            {state.kind === "missing" && (
              <Missing code={code} onBack={onBack} />
            )}

            {(state.kind === "ready" ||
              state.kind === "redeeming" ||
              state.kind === "error") && (
              <CardView
                card={state.kind === "error" && state.card ? state.card : (state as { card: GiftCard }).card}
              >
                {state.kind === "error" && (
                  <p className="mt-6 sans text-[12px] text-rust">{state.error}</p>
                )}
                <button
                  onClick={handleRedeem}
                  disabled={state.kind === "redeeming"}
                  className="mt-8 w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.28em] hover:bg-gold-soft disabled:opacity-60 transition-colors"
                >
                  {state.kind === "redeeming" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                      Redeeming…
                    </>
                  ) : !user ? (
                    <>
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Sign in to Claim Your Gift
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Add to my Wallet
                    </>
                  )}
                </button>
              </CardView>
            )}

            {state.kind === "redeemed" && (
              <CardView card={state.card}>
                <div className="mt-7 inline-flex items-center gap-2 px-3 py-1 border border-gold/50 text-gold text-[10px] uppercase tracking-[0.28em] sans">
                  <Check className="h-3 w-3" strokeWidth={1.8} />
                  Claimed · {formatPrice(state.card.balanceCents)} in your wallet
                </div>
                <p className="mt-4 sans text-[14px] text-cream/65 leading-relaxed">
                  Your gift balance is applied automatically against any
                  commit or sample box. Browse the Vault and choose your
                  scent — we'll deduct the credit at checkout.
                </p>
                <button
                  onClick={onEnterVault}
                  className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.28em] hover:bg-gold-soft transition-colors"
                >
                  Open the Vault
                  <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
                </button>
              </CardView>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CardView({ card, children }: { card: GiftCard; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
          <Gift className="h-3 w-3" strokeWidth={1.4} />
          A gift from {card.senderName}
        </div>
        <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.4} />
      </div>

      <div className="mt-7">
        <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
          For {card.recipientName}
        </div>
        <div className="mt-2 serif text-6xl lg:text-7xl text-gold tabular-nums">
          {formatPrice(card.balanceCents)}
        </div>
        {card.balanceCents !== card.amountCents && (
          <div className="mt-1 sans text-[11px] uppercase tracking-[0.22em] text-cream/40">
            of {formatPrice(card.amountCents)} face value
          </div>
        )}
      </div>

      {card.message && (
        <blockquote className="mt-7 pl-5 border-l-2 border-gold/50 serif italic text-cream/85 text-lg leading-relaxed">
          “{card.message}”
        </blockquote>
      )}

      <div className="mt-7 pt-6 border-t border-obsidian-line/80 grid grid-cols-2 gap-6 sans text-[11px] uppercase tracking-[0.22em] text-cream/55">
        <div>
          <div className="text-cream/40">Code</div>
          <div className="mt-1 text-cream font-mono tracking-widest">{card.code}</div>
        </div>
        <div>
          <div className="text-cream/40">Status</div>
          <div className="mt-1 text-cream capitalize">{card.status}</div>
        </div>
      </div>

      {children}
    </div>
  );
}

function Missing({ code, onBack }: { code: string; onBack: () => void }) {
  return (
    <div>
      <h2 className="serif text-3xl text-cream">Gift not found</h2>
      <p className="mt-3 sans text-[14px] text-cream/65 leading-relaxed">
        We couldn't find a gift card with the code{" "}
        <code className="font-mono text-gold">{code}</code>. The link may
        have been mistyped, or the gift may have been spent already.
      </p>
      <button
        onClick={onBack}
        className="mt-7 inline-flex items-center gap-2 bg-obsidian-soft border border-obsidian-line hover:border-gold/40 text-cream h-11 px-5 sans text-[11px] uppercase tracking-[0.26em] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        Return to the Vault
      </button>
    </div>
  );
}
