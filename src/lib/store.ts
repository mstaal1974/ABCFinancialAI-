import { useEffect, useState, useCallback } from "react";
import type { Commit, Concentration, Fragrance, Gender, Note } from "./types";
import { FRAGRANCES } from "./data";
import { supabase, isSupabaseEnabled } from "./supabase";

const COMMITS_KEY = "mo:commits:v1";
const VIP_KEY = "mo:vip:v1";

type FragranceRow = {
  id: string;
  slug: string;
  name: string;
  inspiration: string | null;
  tagline: string | null;
  story: string | null;
  concentration: string | null;
  oil_percent: number | null;
  volume_ml: number | null;
  price_cents: number;
  comparison_price_cents: number | null;
  gender: string | null;
  moq: number;
  committed: number | null;
  batch_closes_at: string | null;
  vip_only: boolean | null;
};

/**
 * Rebuild a full Fragrance from a Supabase row. Visuals (colors) aren't
 * stored in the DB, so fall back to the matching seed entry by slug — or
 * a sensible default palette for fragrances created via the admin.
 */
function rowToFragrance(row: FragranceRow): Fragrance {
  const seedMatch = FRAGRANCES.find((s) => s.slug === row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    inspiration: row.inspiration ?? seedMatch?.inspiration ?? "",
    tagline: row.tagline ?? seedMatch?.tagline ?? "",
    story: row.story ?? seedMatch?.story ?? "",
    concentration: (row.concentration as Concentration | null) ??
      seedMatch?.concentration ?? "Extrait de Parfum",
    oilPercent: row.oil_percent ?? seedMatch?.oilPercent ?? 30,
    volumeMl: row.volume_ml ?? seedMatch?.volumeMl ?? 50,
    priceCents: row.price_cents,
    comparisonPriceCents:
      row.comparison_price_cents ?? seedMatch?.comparisonPriceCents,
    gender: (row.gender as Gender | null) ?? seedMatch?.gender ?? "unisex",
    moq: row.moq,
    committed: row.committed ?? 0,
    batchClosesAt:
      row.batch_closes_at ??
      seedMatch?.batchClosesAt ??
      new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    notes: seedMatch?.notes ?? ([] as Note[]),
    bottleColor: seedMatch?.bottleColor ?? "#0e0e12",
    glassTint: seedMatch?.glassTint ?? "#1a1a22",
    liquidColor: seedMatch?.liquidColor ?? "#3b2a18",
    accent: seedMatch?.accent ?? "#c9a961",
    vipOnly: row.vip_only ?? seedMatch?.vipOnly ?? false,
  };
}

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

  // Pull the full catalogue from Supabase if configured. Supabase rows
  // win over the seed when slugs match, and any extra rows (e.g. created
  // via the admin) are appended.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseEnabled || !supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from("fragrances").select("*");
        if (error || !data || data.length === 0) return;
        if (cancelled) return;
        const live = (data as FragranceRow[]).map(rowToFragrance);
        const bySlug = new Map(FRAGRANCES.map((f) => [f.slug, f]));
        for (const f of live) bySlug.set(f.slug, f);
        setFragrances(Array.from(bySlug.values()));
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
