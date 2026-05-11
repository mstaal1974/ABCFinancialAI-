import {
  Calendar,
  Check,
  Copy,
  Crown,
  Gift,
  Link as LinkIcon,
  Loader2,
  Lock,
  Mail,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { AuthUser } from "../lib/auth";
import { formatPrice } from "../lib/data";
import {
  SUBSCRIPTION_PLANS,
  type GiftSubscriptionPlan,
  type PurchaseSubscriptionInput,
} from "../lib/giftSubscriptions";
import type { GiftSubscription, GiftSubscriptionPlanMonths } from "../lib/types";

type Props = {
  user: AuthUser | null;
  onRequireAuth: (reason?: string) => void;
  onPurchase: (input: PurchaseSubscriptionInput) => Promise<GiftSubscription>;
};

export default function GiftSubscriptionSection({
  user,
  onRequireAuth,
  onPurchase,
}: Props) {
  const [planMonths, setPlanMonths] = useState<GiftSubscriptionPlanMonths>(
    SUBSCRIPTION_PLANS[1].months,
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleFor, setScheduleFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<GiftSubscription | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const plan: GiftSubscriptionPlan =
    SUBSCRIPTION_PLANS.find((p) => p.months === planMonths) ?? SUBSCRIPTION_PLANS[0];

  const valid =
    recipientName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(recipientEmail) &&
    senderName.trim().length > 0;

  const redeemUrl = useMemo(
    () =>
      purchased
        ? `${window.location.origin}/#/subscription/${purchased.code}`
        : "",
    [purchased],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      onRequireAuth("Sign in to send a gift subscription.");
      return;
    }
    if (!valid) {
      setError("Please fill in every field before sending.");
      return;
    }
    setSubmitting(true);
    try {
      const sub = await onPurchase({
        planMonths,
        senderName: senderName.trim(),
        senderEmail: user.email ?? null,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        message: message.trim() || null,
        scheduledFor: scheduleFor ? new Date(scheduleFor).toISOString() : null,
      });
      setPurchased(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place subscription order.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPurchased(null);
    setRecipientName("");
    setRecipientEmail("");
    setMessage("");
    setScheduleFor("");
    setPlanMonths(SUBSCRIPTION_PLANS[1].months);
  }

  async function copyText(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard not available */
    }
  }

  const monthly = Math.round(plan.priceCents / plan.months);

  return (
    <section id="subscription" className="relative bg-obsidian-soft/30 border-y border-obsidian-line">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 items-start">
          {/* LEFT — pitch */}
          <div className="lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 text-gold text-[10px] uppercase tracking-[0.32em] sans">
              <Crown className="h-3 w-3" strokeWidth={1.4} />
              Gift a Subscription
            </div>
            <h2 className="mt-6 serif text-4xl lg:text-5xl leading-[1.05] text-cream">
              A new <span className="italic text-gold">scent</span>,
              <br />
              every month.
            </h2>
            <p className="mt-5 sans text-[15px] text-cream/65 leading-relaxed max-w-md">
              Give a season — or a year — of fragrance discovery. The
              recipient picks one bottle from the Vault each month, on
              their own schedule. We ship; you bask in the credit.
            </p>

            <ul className="mt-8 space-y-3 sans text-[14px] text-cream/75">
              {[
                "One full-size 50 ml Extrait per month, recipient's choice",
                "They redeem once and pick on their own cadence",
                "Includes early access to VIP-only batches",
                "You can schedule the gift email for any future date",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {/* Card mock */}
            <div className="mt-10 relative">
              <div
                aria-hidden
                className="absolute -inset-px"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(201,169,97,0.55), transparent 50%, rgba(201,169,97,0.18) 100%)",
                }}
              />
              <div className="relative bg-obsidian-soft border border-gold/30 p-7">
                <div className="flex items-center justify-between">
                  <div className="serif text-sm tracking-[0.3em] uppercase text-cream/70">
                    Maison · Obsidian
                  </div>
                  <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.4} />
                </div>
                <div className="mt-7 sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                  {plan.label} subscription · {plan.months} months
                </div>
                <div className="mt-1 serif text-5xl text-gold tabular-nums">
                  {formatPrice(plan.priceCents)}
                </div>
                <div className="mt-1 sans text-[11px] uppercase tracking-[0.22em] text-cream/40 tabular-nums">
                  ≈ {formatPrice(monthly)} / month
                </div>
                <div className="mt-4 sans text-[11px] uppercase tracking-[0.22em] text-cream/45">
                  For {recipientName.trim() || "—"} · From {senderName.trim() || "—"}
                </div>
                <div className="mt-6 pt-4 border-t border-obsidian-line/80 flex items-center justify-between sans text-[10px] uppercase tracking-[0.22em]">
                  <span className="text-cream/40">Redemption</span>
                  <span className="text-cream/65 font-mono tracking-widest">
                    MO-SUB-XXXX
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — purchase / confirmation */}
          <div className="bg-obsidian-soft/50 border border-obsidian-line p-8 lg:p-10">
            {purchased ? (
              <Confirmation
                subscription={purchased}
                redeemUrl={redeemUrl}
                copied={copied}
                onCopyCode={() => copyText(purchased.code, "code")}
                onCopyLink={() => copyText(redeemUrl, "link")}
                onAnother={reset}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <fieldset>
                  <legend className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
                    Choose a Plan
                  </legend>
                  <div className="mt-4 grid sm:grid-cols-3 gap-px bg-obsidian-line">
                    {SUBSCRIPTION_PLANS.map((p) => {
                      const active = planMonths === p.months;
                      return (
                        <button
                          key={p.months}
                          type="button"
                          onClick={() => setPlanMonths(p.months)}
                          className={`p-5 text-left transition-colors ${
                            active
                              ? "bg-gold text-obsidian"
                              : "bg-obsidian text-cream/80 hover:bg-obsidian-soft"
                          }`}
                        >
                          <div className="serif text-2xl">{p.label}</div>
                          <div className="mt-1 sans text-[11px] uppercase tracking-[0.22em] opacity-80">
                            {p.months} months
                          </div>
                          <div
                            className={`mt-3 serif text-xl tabular-nums ${
                              active ? "text-obsidian" : "text-gold"
                            }`}
                          >
                            {formatPrice(p.priceCents)}
                          </div>
                          <div
                            className={`mt-1 sans text-[11px] ${
                              active ? "text-obsidian/70" : "text-cream/40"
                            }`}
                          >
                            {p.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
                    For
                  </legend>
                  <Field
                    label="Recipient name"
                    value={recipientName}
                    onChange={setRecipientName}
                    placeholder="Their name"
                    autoComplete="name"
                  />
                  <Field
                    label="Recipient email"
                    value={recipientEmail}
                    onChange={setRecipientEmail}
                    placeholder="them@example.com"
                    type="email"
                    autoComplete="email"
                    icon={<Mail className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  />
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
                    From
                  </legend>
                  <Field
                    label="Your name"
                    value={senderName}
                    onChange={setSenderName}
                    placeholder="Sign the card"
                    autoComplete="name"
                  />
                  <label className="block">
                    <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                      Personal message (optional)
                    </span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={240}
                      rows={3}
                      placeholder="Write a short note for the card."
                      className="mt-2 w-full bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-2 text-cream sans placeholder:text-cream/30 resize-none transition-colors"
                    />
                    <div className="mt-1 text-right sans text-[10px] uppercase tracking-[0.22em] text-cream/40 tabular-nums">
                      {message.length} / 240
                    </div>
                  </label>
                  <label className="block">
                    <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45 inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" strokeWidth={1.6} />
                      Deliver on (optional)
                    </span>
                    <input
                      type="date"
                      value={scheduleFor}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setScheduleFor(e.target.value)}
                      className="mt-2 w-full bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-2 text-cream sans transition-colors"
                    />
                  </label>
                </fieldset>

                {error && (
                  <p className="sans text-[12px] text-rust">{error}</p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.28em] hover:bg-gold-soft disabled:opacity-60 transition-colors"
                  >
                    {!user ? (
                      <>
                        <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Sign in to Send a Subscription
                      </>
                    ) : submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                        Sending the gift…
                      </>
                    ) : (
                      <>
                        <Gift className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Send {plan.label} ({formatPrice(plan.priceCents)})
                      </>
                    )}
                  </button>
                  <p className="mt-3 sans text-[11px] text-cream/50 leading-relaxed">
                    Charged today. {scheduleFor
                      ? `We'll email the recipient on ${new Date(scheduleFor).toLocaleDateString()}.`
                      : "We'll email them the moment you confirm."}{" "}
                    They claim once, then pick fragrances at their own pace.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Confirmation({
  subscription,
  redeemUrl,
  copied,
  onCopyCode,
  onCopyLink,
  onAnother,
}: {
  subscription: GiftSubscription;
  redeemUrl: string;
  copied: "code" | "link" | null;
  onCopyCode: () => void;
  onCopyLink: () => void;
  onAnother: () => void;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/50 text-gold text-[10px] uppercase tracking-[0.28em] sans">
        <Check className="h-3 w-3" strokeWidth={1.8} />
        Subscription sent
      </div>
      <h3 className="mt-4 serif text-3xl text-cream leading-tight">
        On its way to{" "}
        <span className="italic text-gold">{subscription.recipientName}</span>.
      </h3>
      <p className="mt-3 sans text-[14px] text-cream/65 leading-relaxed">
        We've emailed{" "}
        <span className="text-cream">{subscription.recipientEmail}</span> with
        the redemption link. They'll pick one fragrance from the Vault each
        month for the next {subscription.planMonths} months.
      </p>

      <div className="mt-7 grid grid-cols-3 gap-px bg-obsidian-line">
        <Stat label="Months" value={subscription.planMonths.toString()} />
        <Stat label="Status" value={subscription.status} />
        <Stat label="Total" value={formatPrice(subscription.priceCents)} />
      </div>

      <div className="mt-3 bg-obsidian border border-obsidian-line p-5">
        <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
          Redemption code
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <code className="serif text-2xl text-gold tracking-widest font-mono">
            {subscription.code}
          </code>
          <button
            onClick={onCopyCode}
            className="inline-flex items-center gap-1.5 sans text-[11px] uppercase tracking-[0.22em] text-cream/65 hover:text-gold border border-obsidian-line hover:border-gold/50 px-3 h-9 transition-colors"
          >
            {copied === "code" ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {copied === "code" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-3 bg-obsidian border border-obsidian-line p-5">
        <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
          Shareable link
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 min-w-0">
          <span className="sans text-[12px] text-cream/80 truncate font-mono">
            {redeemUrl}
          </span>
          <button
            onClick={onCopyLink}
            className="shrink-0 inline-flex items-center gap-1.5 sans text-[11px] uppercase tracking-[0.22em] text-cream/65 hover:text-gold border border-obsidian-line hover:border-gold/50 px-3 h-9 transition-colors"
          >
            {copied === "link" ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
            ) : (
              <LinkIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <button
        onClick={onAnother}
        className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-obsidian-soft border border-obsidian-line text-cream h-11 sans text-[11px] uppercase tracking-[0.28em] hover:border-gold/50 transition-colors"
      >
        <PackageOpen className="h-4 w-4" strokeWidth={1.6} />
        Send another subscription
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-obsidian px-4 py-3">
      <div className="sans text-[10px] uppercase tracking-[0.22em] text-cream/45">
        {label}
      </div>
      <div className="mt-1 serif text-lg text-cream capitalize tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
        {label}
      </span>
      <div className="mt-2 relative">
        {icon && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-cream/40">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-2.5 text-cream sans placeholder:text-cream/30 transition-colors ${
            icon ? "pl-6" : ""
          }`}
        />
      </div>
    </label>
  );
}
