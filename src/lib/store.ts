import { useEffect, useState, useCallback } from "react";
import type { Commit, Fragrance } from "./types";
import { FRAGRANCES } from "./data";
import { supabase, isSupabaseEnabled } from "./supabase";

const COMMITS_KEY = "mo:commits:v1";
const VIP_KEY = "mo:vip:v1";

function loadCommits(): Commit[] {
  try {
    const raw = localStorage.getItem(COMMITS_KEY);
    return raw ? (JSON.parse(raw) as Commit[]) : [];
  } catch {
    return [];
  }
}

function saveCommits(commits: Commit[]) {
  localStorage.setItem(COMMITS_KEY, JSON.stringify(commits));
}

/**
 * Hook: track a user's local commits across the session and reflect them
 * onto fragrance batch counters. Falls back to seed data when Supabase is
 * unreachable so the MVP demo always works.
 */
export function useFragrances() {
  const [fragrances, setFragrances] = useState<Fragrance[]>(FRAGRANCES);
  const [commits, setCommits] = useState<Commit[]>(() => loadCommits());
  const [loading, setLoading] = useState(false);

  // Pull live counts from Supabase if configured.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseEnabled || !supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from("fragrances").select("*");
        if (error || !data || data.length === 0) return;
        if (cancelled) return;
        // Merge live committed counts onto our seed list (so a missing row
        // doesn't blank the catalogue during the demo).
        setFragrances((prev) =>
          prev.map((f) => {
            const live = data.find((r: { id: string }) => r.id === f.id);
            return live ? { ...f, committed: live.committed ?? f.committed } : f;
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => saveCommits(commits), [commits]);

  const commit = useCallback(
    async (
      fragranceId: string,
      customLabel: string | null,
      userMeta?: { userId?: string; userEmail?: string | null },
    ) => {
      const newCommit: Commit = {
        id: crypto.randomUUID(),
        fragranceId,
        customLabel: customLabel?.trim() ? customLabel.trim() : null,
        createdAt: new Date().toISOString(),
        // Stripe authorize-now payment intent (stub — see lib/stripe.ts).
        paymentIntentId: `pi_stub_${Math.random().toString(36).slice(2, 12)}`,
        status: "authorized",
      };
      setCommits((prev) => [...prev, newCommit]);
      setFragrances((prev) =>
        prev.map((f) =>
          f.id === fragranceId ? { ...f, committed: f.committed + 1 } : f,
        ),
      );
      // Best-effort write to Supabase. Ignored on failure.
      if (isSupabaseEnabled && supabase) {
        try {
          await supabase.from("commits").insert({
            id: newCommit.id,
            fragrance_id: fragranceId,
            // Only include user_id when it's a real Supabase auth uuid.
            user_id:
              userMeta?.userId && !userMeta.userId.startsWith("demo-")
                ? userMeta.userId
                : null,
            user_email: userMeta?.userEmail ?? null,
            custom_label: newCommit.customLabel,
            payment_intent_id: newCommit.paymentIntentId,
            status: newCommit.status,
          });
        } catch {
          /* offline — fine for MVP */
        }
      }
      return newCommit;
    },
    [],
  );

  const releaseCommit = useCallback((commitId: string) => {
    setCommits((prev) => {
      const target = prev.find((c) => c.id === commitId);
      if (!target) return prev;
      setFragrances((fs) =>
        fs.map((f) =>
          f.id === target.fragranceId
            ? { ...f, committed: Math.max(0, f.committed - 1) }
            : f,
        ),
      );
      return prev.filter((c) => c.id !== commitId);
    });
  }, []);

  return { fragrances, setFragrances, commits, commit, releaseCommit, loading };
}

export function useVIP() {
  const [vip, setVip] = useState<boolean>(() => {
    try {
      return localStorage.getItem(VIP_KEY) === "1";
    } catch {
      return false;
    }
  });
  const join = useCallback(() => {
    setVip(true);
    try {
      localStorage.setItem(VIP_KEY, "1");
    } catch {
      /* ignore quota errors */
    }
  }, []);
  const leave = useCallback(() => {
    setVip(false);
    try {
      localStorage.removeItem(VIP_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return { vip, join, leave };
}
