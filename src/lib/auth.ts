import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseEnabled, supabase } from "./supabase";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: "email" | "google" | "demo";
};

const DEMO_KEY = "mo:demo-user:v1";

function fromSession(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
  return {
    id: u.id,
    email: u.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
    provider: u.app_metadata?.provider === "google" ? "google" : "email",
  };
}

function readDemo(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Auth hook backed by Supabase. When Supabase is unreachable or the
 * project's auth is not configured, falls back to a localStorage "demo"
 * user so the rest of the MVP UX still works in offline previews.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => readDemo());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!isSupabaseEnabled || !supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const live = fromSession(data.session);
      if (live) setUser(live);
      setLoading(false);
    }
    void init();

    if (!supabase) return () => { cancelled = true; };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const live = fromSession(session);
      if (live) {
        setUser(live);
        try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
      } else {
        // Don't blow away the demo session on a transient auth state nudge.
        const demo = readDemo();
        setUser(demo);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) {
      throw new Error("Google sign-in requires a configured Supabase project.");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      // Demo fallback: accept anything and persist locally.
      const demo: AuthUser = {
        id: `demo-${crypto.randomUUID()}`,
        email,
        name: email.split("@")[0],
        avatarUrl: null,
        provider: "demo",
      };
      localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
      setUser(demo);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string, name?: string) {
    if (!supabase) {
      const demo: AuthUser = {
        id: `demo-${crypto.randomUUID()}`,
        email,
        name: name ?? email.split("@")[0],
        avatarUrl: null,
        provider: "demo",
      };
      localStorage.setItem(DEMO_KEY, JSON.stringify(demo));
      setUser(demo);
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: name ? { full_name: name } : undefined },
    });
    if (error) throw error;
  }

  async function signOut() {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    isSupabaseAuth: isSupabaseEnabled,
  };
}
