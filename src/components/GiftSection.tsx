import { Check, Copy, Gift, Link as LinkIcon, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuthUser } from "../lib/auth";
import {
  GIFT_MAX_CENTS,
  GIFT_MIN_CENTS,
  GIFT_PRESETS,
  type PurchaseGiftInput,
} from "../lib/gifts";
import { formatPrice } from "../lib/data";
import type { GiftCard } from "../lib/types";

type Props = {
  user: AuthUser | null;
  onRequireAuth: (reason?: string) => void;
  onPurchase: (input: PurchaseGiftInput) => Promise<GiftCard>;
};

export default function GiftSection({ user, onRequireAuth, onPurchase }: Props) {
  const [presetCents, setPresetCents] = useState<number>(GIFT_PRESETS[1].cents);
  const [customCents, setCustomCents] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleFor, setScheduleFor] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<GiftCard | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const amountCents = customCents ?? presetCents;
  const valid =
    recipientName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(recipientEmail) &&
    senderName.trim().length > 0 &&
    amountCents >= GIFT_MIN_CENTS &&
    amountCents <= GIFT_MAX_CENTS;

  const redeemUrl = useMemo(
    () => (purchased ? `${window.location.origin}/#/gift/${purchased.code}` : ""),
    [purchased],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      onRequireAuth("Sign in to send a gift card.");
      return;
    }
    if (!valid) {
      setError("Please fill in every field and choose a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const card = await onPurchase({
        amountCents,
        senderName: senderName.trim(),
        senderEmail: user.email ?? null,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        message: message.trim() || null,
        scheduledFor: scheduleFor ? new Date(scheduleFor).toISOString() : null,
      });
      setPurchased(card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place gift order.");
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
    setCustomCents(null);
    setPresetCents(GIFT_PRESETS[1].cents);
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

  return (
    <section id="gift" className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-16 items-start">
          {/* LEFT — pitch */}
          <div className="lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 text-gold text-[10px] uppercase tracking-[0.32em] sans">
              <Gift className="h-3 w-3" strokeWidth={1.4} />
              Send a Gift
            </div>
            <h2 className="mt-6 serif text-4xl lg:text-5xl leading-[1.05] text-cream">
              Send the <span className="italic text-gold">choice</span>,
              <br />
              not the bottle.
            </h2>
            <p className="mt-5 sans text-[15px] text-cream/65 leading-relaxed max-w-md">
              Fragrance is personal. Choose an amount and we'll send the
              recipient a redemption code; they pick their own scent — or
              their own batch — at any time. No guesswork, no returns.
            </p>

            <ul className="mt-8 space-y-3 sans text-[14px] text-cream/75">
              {[
                "Email arrives instantly, or schedule for the day that matters",
                "Balance is theirs — usable across any open batch or sample box",
                "Unused credit never expires within the first 12 months",
                "We email you the redemption confirmation once it's claimed",
              ].map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.6} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {/* Hand-drawn gift card preview */}
            <div className="mt-10 relative">
              <div
                aria-hidden
                className="absolute -inset-px"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(201,169,97,0.5), transparent 50%, rgba(201,169,97,0.18) 100%)",
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
                  A gift for {recipientName.trim() || "—"}
                </div>
                <div className="mt-1 serif text-5xl text-gold tabular-nums">
                  {formatPrice(amountCents)}
                </div>
                <div className="mt-4 sans text-[11px] uppercase tracking-[0.22em] text-cream/45">
                  From {senderName.trim() || "—"}
                </div>
                <div className="mt-6 pt-4 border-t border-obsidian-line/80 flex items-center justify-between sans text-[10px] uppercase tracking-[0.22em]">
                  <span className="text-cream/40">Code</span>
                  <span className="text-cream/65 font-mono tracking-widest">
                    MO-XXXX-XXXX
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — purchase / confirmation */}
          <div className="bg-obsidian-soft/40 border border-obsidian-line p-8 lg:p-10">
            {purchased ? (
              <Confirmation
                card={purchased}
                redeemUrl={redeemUrl}
                copied={copied}
                onCopyCode={() => copyText(purchased.code, "code")}
                onCopyLink={() => copyText(redeemUrl, "link")}
                onAnother={reset}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Amount */}
                <fieldset>
                  <legend className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
                    Choose an Amount
                  </legend>
                  <div className="mt-4 grid grid-cols-2 gap-px bg-obsidian-line">
                    {GIFT_PRESETS.map((p) => {
                      const active = customCents === null && presetCents === p.cents;
                      return (
                        <button
                          key={p.cents}
                          type="button"
                          onClick={() => {
                            setPresetCents(p.cents);
                            setCustomCents(null);
                          }}
                          className={`p-5 text-left transition-colors ${
                            active
                              ? "bg-gold text-obsidian"
                              : "bg-obsidian text-cream/80 hover:bg-obsidian-soft"
                          }`}
                        >
                          <div className="serif text-2xl tabular-nums">
                            {formatPrice(p.cents)}
                          </div>
                          <div className="mt-1 sans text-[11px] uppercase tracking-[0.22em] opacity-80">
                            {p.label}
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

                  <label className="mt-4 block">
                    <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                      Or a custom amount
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="serif text-2xl text-cream/40">$</span>
                      <input
                        type="number"
                        min={GIFT_MIN_CENTS / 100}
                        max={GIFT_MAX_CENTS / 100}
                        step={5}
                        value={customCents !== null ? (customCents / 100).toString() : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setCustomCents(null);
                            return;
                          }
                          const cents = Math.round(parseFloat(v) * 100);
                          if (Number.isFinite(cents)) setCustomCents(cents);
                        }}
                        placeholder="Custom"
                        className="flex-1 bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-2 text-cream sans text-2xl tabular-nums placeholder:text-cream/30 transition-colors"
                      />
                    </div>
                    <div className="mt-1 sans text-[10px] uppercase tracking-[0.22em] text-cream/40">
                      Min {formatPrice(GIFT_MIN_CENTS)} · Max{" "}
                      {formatPrice(GIFT_MAX_CENTS)}
                    </div>
                  </label>
                </fieldset>

                {/* Recipient */}
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

                {/* Sender */}
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
                    <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
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
                        Sign in to Send a Gift
                      </>
                    ) : submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                        Sending the gift…
                      </>
                    ) : (
                      <>
                        <Gift className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Send {formatPrice(amountCents)} to{" "}
                        {recipientName.trim() || "recipient"}
                      </>
                    )}
                  </button>
                  <p className="mt-3 sans text-[11px] text-cream/50 leading-relaxed">
                    The gift card is charged to your card today.{" "}
                    {scheduleFor
                      ? `We'll email it on ${new Date(scheduleFor).toLocaleDateString()}.`
                      : "We'll email it the moment you confirm."}
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
  card,
  redeemUrl,
  copied,
  onCopyCode,
  onCopyLink,
  onAnother,
}: {
  card: GiftCard;
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
        Gift sent
      </div>
      <h3 className="mt-4 serif text-3xl text-cream leading-tight">
        On its way to <span className="italic text-gold">{card.recipientName}</span>.
      </h3>
      <p className="mt-3 sans text-[14px] text-cream/65 leading-relaxed">
        We've emailed{" "}
        <span className="text-cream">{card.recipientEmail}</span>{" "}
        with the redemption link. They can sign in (or create an account)
        and apply the {formatPrice(card.amountCents)} balance to any open
        batch or sample box.
      </p>

      <div className="mt-7 bg-obsidian border border-obsidian-line p-5">
        <div className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
          Redemption code
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <code className="serif text-2xl text-gold tracking-widest font-mono">
            {card.code}
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
        className="mt-7 w-full bg-obsidian-soft border border-obsidian-line text-cream h-11 sans text-[11px] uppercase tracking-[0.28em] hover:border-gold/50 transition-colors"
      >
        Send another gift
      </button>
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
