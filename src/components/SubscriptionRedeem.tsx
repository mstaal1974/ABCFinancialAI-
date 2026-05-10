import {
  ArrowLeft,
  Check,
  Crown,
  Gift,
  Loader2,
  Lock,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../lib/auth";
import { formatPrice } from "../lib/data";
import type { Fragrance, GiftSubscription } from "../lib/types";

type RedeemResult =
  | { ok: true; subscription: GiftSubscription }
  | { ok: false; error: string };

type Props = {
  code: string;
  user: AuthUser | null;
  fragrances: Fragrance[];
  onLookup: (code: string) => Promise<GiftSubscription | null>;
  onRedeem: (code: string) => Promise<RedeemResult>;
  onPick: (subscriptionId: string, fragranceId: string) => Promise<RedeemResult>;
  onRequireAuth: (reason?: string) => void;
  onBack: () => void;
};

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; subscription: GiftSubscription }
  | { kind: "redeeming"; subscription: GiftSubscription }
  | { kind: "claimed"; subscription: GiftSubscription }
  | { kind: "picking"; subscription: GiftSubscription }
  | { kind: "error"; error: string; subscription: GiftSubscription };

export default function SubscriptionRedeem({
  code,
  user,
  fragrances,
  onLookup,
  onRedeem,
  onPick,
  onRequireAuth,
  onBack,
}: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sub = await onLookup(code);
      if (cancelled) return;
      if (!sub) {
        setState({ kind: "missing" });
        return;
      }
      // Already redeemed by *this* user? Make sure it's in their local
      // wallet so they can keep picking from a fresh browser too.
      if (sub.redeemedByEmail && user?.email === sub.redeemedByEmail) {
        const result = await onRedeem(code);
        if (cancelled) return;
        if (result.ok) {
          setState({ kind: "claimed", subscription: result.subscription });
        } else {
          setState({ kind: "error", error: result.error, subscription: sub });
        }
        return;
      }
      setState({ kind: "ready", subscription: sub });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, onLookup, onRedeem, user?.email]);

  async function handleRedeem() {
    if (state.kind !== "ready") return;
    if (!user) {
      onRequireAuth("Sign in or create an account to claim this subscription.");
      return;
    }
    setState({ kind: "redeeming", subscription: state.subscription });
    const result = await onRedeem(code);
    if (result.ok) {
      setState({ kind: "claimed", subscription: result.subscription });
    } else {
      setState({
        kind: "error",
        error: result.error,
        subscription: state.subscription,
      });
    }
  }

  async function handlePick() {
    if (state.kind !== "claimed" || !selectedId) return;
    setState({ kind: "picking", subscription: state.subscription });
    const result = await onPick(state.subscription.id, selectedId);
    if (result.ok) {
      setSelectedId(null);
      setState({ kind: "claimed", subscription: result.subscription });
    } else {
      setState({
        kind: "error",
        error: result.error,
        subscription: state.subscription,
      });
    }
  }

  return (
    <section className="relative">
      <div className="mx-auto max-w-4xl px-6 lg:px-10 py-16 lg:py-24">
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
                  Looking up your subscription…
                </p>
              </div>
            )}

            {state.kind === "missing" && <Missing code={code} onBack={onBack} />}

            {(state.kind === "ready" ||
              state.kind === "redeeming" ||
              (state.kind === "error" && !state.subscription.redeemedByEmail)) && (
              <SubscriptionView subscription={state.subscription}>
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
                      Claiming…
                    </>
                  ) : !user ? (
                    <>
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Sign in to Claim Your Subscription
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Claim {state.subscription.planMonths} months
                    </>
                  )}
                </button>
              </SubscriptionView>
            )}

            {(state.kind === "claimed" ||
              state.kind === "picking" ||
              (state.kind === "error" && state.subscription.redeemedByEmail)) && (
              <ClaimedView
                subscription={state.subscription}
                fragrances={fragrances}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onPick={handlePick}
                isPicking={state.kind === "picking"}
                error={state.kind === "error" ? state.error : null}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SubscriptionView({
  subscription,
  children,
}: {
  subscription: GiftSubscription;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
          <Gift className="h-3 w-3" strokeWidth={1.4} />
          A subscription from {subscription.senderName}
        </div>
        <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.4} />
      </div>

      <div className="mt-7">
        <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
          For {subscription.recipientName}
        </div>
        <div className="mt-2 serif text-6xl lg:text-7xl text-gold tabular-nums">
          {subscription.planMonths} months
        </div>
        <div className="mt-1 sans text-[11px] uppercase tracking-[0.22em] text-cream/40">
          one fragrance per month · {formatPrice(subscription.priceCents)} value
        </div>
      </div>

      {subscription.message && (
        <blockquote className="mt-7 pl-5 border-l-2 border-gold/50 serif italic text-cream/85 text-lg leading-relaxed">
          “{subscription.message}”
        </blockquote>
      )}

      <div className="mt-7 pt-6 border-t border-obsidian-line/80 grid grid-cols-2 gap-6 sans text-[11px] uppercase tracking-[0.22em] text-cream/55">
        <div>
          <div className="text-cream/40">Code</div>
          <div className="mt-1 text-cream font-mono tracking-widest">{subscription.code}</div>
        </div>
        <div>
          <div className="text-cream/40">Status</div>
          <div className="mt-1 text-cream capitalize">{subscription.status}</div>
        </div>
      </div>

      {children}
    </div>
  );
}

function ClaimedView({
  subscription,
  fragrances,
  selectedId,
  onSelect,
  onPick,
  isPicking,
  error,
}: {
  subscription: GiftSubscription;
  fragrances: Fragrance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPick: () => void;
  isPicking: boolean;
  error: string | null;
}) {
  const totalMonths = subscription.planMonths;
  const claimedMonths = subscription.picks.length;
  const monthsRemaining = totalMonths - claimedMonths;
  const pickedFragranceIds = new Set(subscription.picks.map((p) => p.fragranceId));
  const available = fragrances.filter((f) => !pickedFragranceIds.has(f.id));
  const isComplete = subscription.status === "completed";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/50 text-gold text-[10px] uppercase tracking-[0.28em] sans">
          <Crown className="h-3 w-3" strokeWidth={1.6} />
          {isComplete ? "Subscription complete" : "Subscription claimed"}
        </div>
        <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.4} />
      </div>

      <h2 className="mt-5 serif text-3xl lg:text-4xl text-cream leading-tight">
        {isComplete ? (
          <>Every month claimed.</>
        ) : (
          <>
            Pick month {claimedMonths + 1} of{" "}
            <span className="text-gold tabular-nums">{totalMonths}</span>.
          </>
        )}
      </h2>

      <div className="mt-6 grid grid-cols-3 gap-px bg-obsidian-line">
        <Stat label="Months claimed" value={`${claimedMonths} / ${totalMonths}`} />
        <Stat label="Months left" value={monthsRemaining.toString()} />
        <Stat label="From" value={subscription.senderName} />
      </div>

      {subscription.picks.length > 0 && (
        <div className="mt-8">
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/55">
            Your picks so far
          </div>
          <ol className="mt-3 space-y-2">
            {subscription.picks.map((pick) => {
              const f = fragrances.find((x) => x.id === pick.fragranceId);
              return (
                <li
                  key={pick.id}
                  className="flex items-center justify-between gap-4 border border-obsidian-line bg-obsidian px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="sans text-[10px] uppercase tracking-[0.22em] text-cream/45 tabular-nums">
                      Month {pick.monthIndex}
                    </span>
                    <span className="serif text-cream">
                      {f?.name ?? pick.fragranceId}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 sans text-[10px] uppercase tracking-[0.22em] text-gold/80">
                    <PackageOpen className="h-3 w-3" strokeWidth={1.6} />
                    {pick.status}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!isComplete && (
        <div className="mt-8">
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/55">
            Choose this month's fragrance
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
            {available.length === 0 ? (
              <div className="col-span-full sans text-[12px] text-cream/55 px-2 py-6">
                You've already picked every fragrance in the catalogue.
              </div>
            ) : (
              available.map((f) => {
                const active = selectedId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelect(f.id)}
                    className={`text-left border px-4 py-3 transition-colors ${
                      active
                        ? "border-gold bg-gold/10"
                        : "border-obsidian-line bg-obsidian hover:border-gold/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="serif text-base text-cream">{f.name}</span>
                      {active && (
                        <Check className="h-4 w-4 text-gold" strokeWidth={1.8} />
                      )}
                    </div>
                    <div className="mt-1 sans text-[11px] text-cream/55">
                      {f.tagline}
                    </div>
                    <div className="mt-2 sans text-[10px] uppercase tracking-[0.22em] text-cream/40 capitalize">
                      {f.gender} · {f.concentration}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <p className="mt-4 sans text-[12px] text-rust">{error}</p>
          )}

          <button
            onClick={onPick}
            disabled={!selectedId || isPicking || available.length === 0}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.28em] hover:bg-gold-soft disabled:opacity-50 transition-colors"
          >
            {isPicking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                Saving your pick…
              </>
            ) : (
              <>
                <PackageOpen className="h-4 w-4" strokeWidth={1.6} />
                Confirm month {claimedMonths + 1}
              </>
            )}
          </button>
        </div>
      )}

      {isComplete && (
        <p className="mt-7 sans text-[14px] text-cream/65 leading-relaxed">
          Every month of your subscription has been claimed. Each fragrance
          will ship on its scheduled cadence — keep an eye on your inbox.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-obsidian px-4 py-3">
      <div className="sans text-[10px] uppercase tracking-[0.22em] text-cream/45">
        {label}
      </div>
      <div className="mt-1 serif text-lg text-cream tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}

function Missing({ code, onBack }: { code: string; onBack: () => void }) {
  return (
    <div>
      <h2 className="serif text-3xl text-cream">Subscription not found</h2>
      <p className="mt-3 sans text-[14px] text-cream/65 leading-relaxed">
        We couldn't find a subscription with the code{" "}
        <code className="font-mono text-gold">{code}</code>. The link may
        have been mistyped, or the gift may have been cancelled.
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
