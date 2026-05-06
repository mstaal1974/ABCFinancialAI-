import { Loader2, Lock, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";

type Mode = "signin" | "signup";

type Props = {
  open: boolean;
  onClose: () => void;
  // Optional copy override — e.g. "Sign in to order your sample box".
  reason?: string;
};

export default function AuthModal({ open, onClose, reason }: Props) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, isSupabaseAuth } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name || undefined);
      }
      onClose();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Authentication failed. Please try again.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // OAuth redirects away; no close needed.
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Google sign-in is unavailable. Use email instead.",
      );
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-obsidian border border-gold/30">
          <div
            aria-hidden
            className="absolute -inset-px pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(201,169,97,0.45), transparent 40%, rgba(201,169,97,0.18) 100%)",
            }}
          />
          <div className="relative bg-obsidian">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 h-8 w-8 flex items-center justify-center text-cream/50 hover:text-gold border border-obsidian-line hover:border-gold/50 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <div className="px-8 pt-10 pb-8">
              <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
                {mode === "signin" ? "The Atelier" : "Create an account"}
              </div>
              <h2 className="mt-3 serif text-3xl text-cream leading-tight">
                {mode === "signin" ? "Welcome back" : "Open the cabinet"}
              </h2>
              {reason && (
                <p className="mt-3 sans text-[13px] text-cream/55 leading-relaxed">
                  {reason}
                </p>
              )}

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="mt-7 w-full inline-flex items-center justify-center gap-3 bg-cream hover:bg-parchment text-obsidian h-11 sans text-[12px] uppercase tracking-[0.22em] disabled:opacity-50 transition-colors"
              >
                <GoogleGlyph />
                Continue with Google
              </button>
              {!isSupabaseAuth && (
                <p className="mt-2 sans text-[11px] text-cream/40">
                  Demo mode — Google sign-in requires a configured Supabase project.
                </p>
              )}

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-obsidian-line" />
                <span className="sans text-[10px] uppercase tracking-[0.28em] text-cream/40">
                  or with email
                </span>
                <span className="h-px flex-1 bg-obsidian-line" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <Field
                    label="Name (optional)"
                    value={name}
                    onChange={setName}
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                  />
                )}
                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@maison.com"
                  icon={<Mail className="h-3.5 w-3.5" strokeWidth={1.5} />}
                />
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="•••••••••"
                  icon={<Lock className="h-3.5 w-3.5" strokeWidth={1.5} />}
                />

                {err && (
                  <p className="sans text-[12px] text-rust">{err}</p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gold text-obsidian h-11 sans text-[12px] uppercase tracking-[0.28em] hover:bg-gold-soft disabled:opacity-50 transition-colors"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />}
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>

              <p className="mt-6 text-center sans text-[12px] text-cream/55">
                {mode === "signin" ? "New to the maison?" : "Already a member?"}{" "}
                <button
                  type="button"
                  className="text-gold hover:underline underline-offset-4"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  autoComplete,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete: string;
  placeholder: string;
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

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.7 0 19.5-8.3 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14l6.6 4.8C14.7 15 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.4 4.5 9.8 8.7 6.3 14z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.2 0 9.9-2 13.5-5.2l-6.2-5.3c-2 1.5-4.5 2.5-7.3 2.5-5.2 0-9.7-3.4-11.3-8L6.3 32C9.7 38.4 16.3 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.3c-.4.4 6.7-4.9 6.7-14.8 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
