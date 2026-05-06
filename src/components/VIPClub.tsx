import { Check, Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";

type Props = { vip: boolean; onJoin: () => void; onLeave: () => void };

const PERKS = [
  "48-hour early access to commit on every new batch",
  "Members-only fragrances unavailable to the public",
  "Two complimentary samples shipped with each batch",
  "Reserved batch slot on signature scents (no waiting)",
  "Direct line to the perfumer for custom commissions",
];

export default function VIPClub({ vip, onJoin, onLeave }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSupabaseEnabled && supabase) {
        try {
          // Best effort — failures don't block enrollment in the demo.
          await supabase.from("subscribers").insert({ email, tier: "vip" });
        } catch {
          /* swallow */
        }
      }
      onJoin();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="vip" className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-16 items-center">
          {/* LEFT — pitch */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 text-gold text-[10px] uppercase tracking-[0.32em] sans">
              <Crown className="h-3 w-3" strokeWidth={1.4} />
              The Inner Circle
            </div>
            <h2 className="mt-6 serif text-4xl lg:text-5xl leading-[1.05] text-cream">
              Members commit <span className="italic text-gold">two days</span>
              <br />
              before the doors open.
            </h2>
            <p className="mt-5 sans text-[15px] text-cream/65 leading-relaxed max-w-lg">
              The VIP Club is how we keep our smallest batches honest. Members
              get first claim on every pour, access to fragrances we never list
              publicly, and a direct channel to the perfumer for one-off
              commissions.
            </p>

            <ul className="mt-8 space-y-3">
              {PERKS.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 sans text-[14px] text-cream/80"
                >
                  <Check
                    className="h-4 w-4 text-gold mt-0.5 shrink-0"
                    strokeWidth={1.6}
                  />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT — card */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-px"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,169,97,0.5), transparent 40%, rgba(201,169,97,0.2) 90%)",
              }}
            />
            <div className="relative bg-obsidian-soft border border-gold/30 p-10 lg:p-12">
              <div className="flex items-center justify-between">
                <div className="serif text-2xl text-cream">VIP Club</div>
                <Sparkles className="h-5 w-5 text-gold" strokeWidth={1.4} />
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="serif text-6xl text-gold">$240</span>
                <span className="sans text-xs uppercase tracking-[0.28em] text-cream/55">
                  / year
                </span>
              </div>
              <p className="mt-2 sans text-[12px] text-cream/50">
                Or applied as credit toward your first three commits.
              </p>

              {vip ? (
                <div className="mt-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-gold/50 text-gold text-[11px] uppercase tracking-[0.28em] sans">
                    <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Membership Active
                  </div>
                  <p className="mt-5 sans text-[13px] text-cream/65">
                    You now have early access to every new batch — including
                    members-only fragrances marked with the lock icon in the
                    Vault.
                  </p>
                  <button
                    onClick={onLeave}
                    className="mt-6 sans text-[11px] uppercase tracking-[0.24em] text-cream/40 hover:text-cream/70 underline-offset-4 hover:underline"
                  >
                    Resign membership
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="mt-10 space-y-4">
                  <div>
                    <label className="sans text-[10px] uppercase tracking-[0.28em] text-cream/45">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@maison.com"
                      className="mt-2 w-full bg-transparent border-b border-obsidian-line focus:border-gold outline-none py-3 text-cream sans placeholder:text-cream/30 transition-colors"
                    />
                  </div>
                  {error && (
                    <p className="sans text-[11px] text-rust">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-12 sans text-[11px] uppercase tracking-[0.32em] hover:bg-gold-soft disabled:opacity-50 transition-colors"
                  >
                    <Crown className="h-4 w-4" strokeWidth={1.6} />
                    {submitting ? "Reserving Your Seat…" : "Join the Inner Circle"}
                  </button>
                  <p className="sans text-[11px] text-cream/45 leading-relaxed">
                    Demo: this enrolls you locally for the duration of the
                    session. In production, payment is taken via Stripe and
                    your account is linked to Supabase Auth.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
