import { useCallback, useEffect, useState } from "react";
import { createShipment } from "./shipments";
import { isSupabaseEnabled, supabase } from "./supabase";
import type {
  GiftSubscription,
  GiftSubscriptionPick,
  GiftSubscriptionPlanMonths,
} from "./types";

const PURCHASED_KEY = "mo:gift-subs-purchased:v1";
const WALLET_KEY = "mo:gift-subs-wallet:v1";

export type GiftSubscriptionPlan = {
  months: GiftSubscriptionPlanMonths;
  priceCents: number;
  label: string;
  sub: string;
};

/** Three plans, priced for a small per-month discount vs. one-off bottles. */
export const SUBSCRIPTION_PLANS: GiftSubscriptionPlan[] = [
  { months: 3,  priceCents: 49500,  label: "Discovery",   sub: "3 fragrances · 1 / month" },
  { months: 6,  priceCents: 94500,  label: "Atelier",     sub: "6 fragrances · 1 / month" },
  { months: 12, priceCents: 180000, label: "Maison",      sub: "12 fragrances · 1 / month" },
];

export function findPlan(months: number): GiftSubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.months === months);
}

function newSubscriptionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `MO-SUB-${rand(4)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

type SubscriptionRow = {
  id: string;
  code: string;
  plan_months: number;
  price_cents: number;
  status: GiftSubscription["status"];
  sender_name: string;
  sender_email: string | null;
  recipient_name: string;
  recipient_email: string;
  message: string | null;
  scheduled_for: string | null;
  redeemed_at: string | null;
  redeemed_by_email: string | null;
  created_at: string;
};

type PickRow = {
  id: string;
  subscription_id: string;
  month_index: number;
  fragrance_id: string;
  picked_at: string;
  ship_at: string | null;
  status: GiftSubscriptionPick["status"];
};

function rowToSubscription(
  row: SubscriptionRow,
  picks: PickRow[] = [],
): GiftSubscription {
  return {
    id: row.id,
    code: row.code,
    planMonths: row.plan_months as GiftSubscriptionPlanMonths,
    priceCents: row.price_cents,
    status: row.status,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    message: row.message,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
    redeemedAt: row.redeemed_at,
    redeemedByEmail: row.redeemed_by_email,
    picks: picks
      .filter((p) => p.subscription_id === row.id)
      .sort((a, b) => a.month_index - b.month_index)
      .map((p) => ({
        id: p.id,
        subscriptionId: p.subscription_id,
        monthIndex: p.month_index,
        fragranceId: p.fragrance_id,
        pickedAt: p.picked_at,
        shipAt: p.ship_at,
        status: p.status,
      })),
  };
}

export type PurchaseSubscriptionInput = {
  planMonths: GiftSubscriptionPlanMonths;
  senderName: string;
  senderEmail: string | null;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  scheduledFor: string | null;
};

/**
 * Gift subscriptions: sender purchases a 3/6/12-month plan, recipient
 * redeems via code/link and picks one fragrance per month from the
 * catalogue. Backed by Supabase when configured; otherwise persists to
 * localStorage for the demo UX.
 */
export function useGiftSubscriptions(currentUserEmail: string | null) {
  const [purchased, setPurchased] = useState<GiftSubscription[]>(() =>
    readJSON<GiftSubscription[]>(PURCHASED_KEY, []),
  );
  const [wallet, setWallet] = useState<GiftSubscription[]>(() =>
    readJSON<GiftSubscription[]>(WALLET_KEY, []),
  );

  useEffect(() => writeJSON(PURCHASED_KEY, purchased), [purchased]);
  useEffect(() => writeJSON(WALLET_KEY, wallet), [wallet]);

  const purchase = useCallback(
    async (input: PurchaseSubscriptionInput): Promise<GiftSubscription> => {
      const plan = findPlan(input.planMonths);
      if (!plan) throw new Error("Unknown subscription plan.");
      const sub: GiftSubscription = {
        id: crypto.randomUUID(),
        code: newSubscriptionCode(),
        planMonths: plan.months,
        priceCents: plan.priceCents,
        status: "active",
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        message: input.message?.trim() ? input.message.trim() : null,
        scheduledFor: input.scheduledFor,
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedByEmail: null,
        picks: [],
      };
      if (isSupabaseEnabled && supabase) {
        try {
          await supabase.from("gift_subscriptions").insert({
            id: sub.id,
            code: sub.code,
            plan_months: sub.planMonths,
            price_cents: sub.priceCents,
            status: sub.status,
            sender_name: sub.senderName,
            sender_email: sub.senderEmail,
            recipient_name: sub.recipientName,
            recipient_email: sub.recipientEmail,
            message: sub.message,
            scheduled_for: sub.scheduledFor,
          });
        } catch {
          /* offline — fine for the demo */
        }
      }
      setPurchased((prev) => [sub, ...prev]);
      return sub;
    },
    [],
  );

  const lookup = useCallback(
    async (code: string): Promise<GiftSubscription | null> => {
      const trimmed = code.trim().toUpperCase();
      const local =
        purchased.find((s) => s.code === trimmed) ??
        wallet.find((s) => s.code === trimmed);
      if (local) return local;

      if (isSupabaseEnabled && supabase) {
        try {
          const { data: subRow } = await supabase
            .from("gift_subscriptions")
            .select("*")
            .eq("code", trimmed)
            .maybeSingle<SubscriptionRow>();
          if (!subRow) return null;
          const { data: pickRows } = await supabase
            .from("gift_subscription_picks")
            .select("*")
            .eq("subscription_id", subRow.id);
          return rowToSubscription(subRow, (pickRows ?? []) as PickRow[]);
        } catch {
          /* fall through */
        }
      }
      return null;
    },
    [purchased, wallet],
  );

  const redeem = useCallback(
    async (
      code: string,
    ): Promise<
      { ok: true; subscription: GiftSubscription } | { ok: false; error: string }
    > => {
      if (!currentUserEmail) {
        return { ok: false, error: "Sign in to redeem this subscription." };
      }
      const found = await lookup(code);
      if (!found) return { ok: false, error: "We couldn't find that code." };
      if (found.status === "completed") {
        return { ok: false, error: "Every month of this plan has been claimed." };
      }
      if (found.status === "cancelled") {
        return { ok: false, error: "This subscription has been cancelled." };
      }
      // Already redeemed by someone else? Block.
      if (
        found.redeemedByEmail &&
        found.redeemedByEmail !== currentUserEmail
      ) {
        return {
          ok: false,
          error: "This subscription was already claimed by another account.",
        };
      }

      // Either fresh or already-claimed by *this* user — make sure it's in
      // their wallet so they can keep picking on subsequent visits.
      const alreadyInWallet = wallet.find((s) => s.id === found.id);
      if (alreadyInWallet) return { ok: true, subscription: alreadyInWallet };

      const isFresh = !found.redeemedByEmail;
      const claimed: GiftSubscription = {
        ...found,
        status: isFresh && found.status === "active" ? "redeemed" : found.status,
        redeemedAt: found.redeemedAt ?? new Date().toISOString(),
        redeemedByEmail: found.redeemedByEmail ?? currentUserEmail,
      };
      if (isFresh && isSupabaseEnabled && supabase) {
        try {
          await supabase
            .from("gift_subscriptions")
            .update({
              status: claimed.status,
              redeemed_at: claimed.redeemedAt,
              redeemed_by_email: claimed.redeemedByEmail,
            })
            .eq("id", claimed.id);
        } catch {
          /* offline */
        }
      }
      setWallet((prev) => [claimed, ...prev.filter((s) => s.id !== claimed.id)]);
      return { ok: true, subscription: claimed };
    },
    [currentUserEmail, lookup, wallet],
  );

  /**
   * Recipient picks the next month's fragrance. monthIndex is 1-based and
   * must be the next unclaimed month. Returns the updated subscription.
   */
  const pickMonth = useCallback(
    async (
      subscriptionId: string,
      fragranceId: string,
    ): Promise<
      { ok: true; subscription: GiftSubscription } | { ok: false; error: string }
    > => {
      const target = wallet.find((s) => s.id === subscriptionId);
      if (!target) return { ok: false, error: "Subscription not in your wallet." };
      if (target.status === "completed") {
        return { ok: false, error: "Every month has been claimed." };
      }
      const nextIndex = target.picks.length + 1;
      if (nextIndex > target.planMonths) {
        return { ok: false, error: "All months are already claimed." };
      }
      const pick: GiftSubscriptionPick = {
        id: crypto.randomUUID(),
        subscriptionId: target.id,
        monthIndex: nextIndex,
        fragranceId,
        pickedAt: new Date().toISOString(),
        shipAt: null,
        status: "queued",
      };
      const nextStatus: GiftSubscription["status"] =
        nextIndex === target.planMonths ? "completed" : "redeemed";
      const updated: GiftSubscription = {
        ...target,
        status: nextStatus,
        picks: [...target.picks, pick],
      };

      if (isSupabaseEnabled && supabase) {
        try {
          const { error: pickErr } = await supabase
            .from("gift_subscription_picks")
            .insert({
              id: pick.id,
              subscription_id: pick.subscriptionId,
              month_index: pick.monthIndex,
              fragrance_id: pick.fragranceId,
              status: pick.status,
            });
          if (pickErr) {
            return { ok: false, error: pickErr.message };
          }
          if (nextStatus !== target.status) {
            await supabase
              .from("gift_subscriptions")
              .update({ status: nextStatus })
              .eq("id", target.id);
          }
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Could not save your pick.",
          };
        }
      }

      setWallet((prev) => prev.map((s) => (s.id === target.id ? updated : s)));

      // Auto-create a shipment row so the recipient can track this pick.
      try {
        await createShipment({
          sourceType: "subscription_pick",
          sourceId: pick.id,
          userId: null,
          userEmail: currentUserEmail,
          recipientName: target.recipientName,
        });
      } catch {
        /* tracking is best-effort */
      }

      return { ok: true, subscription: updated };
    },
    [currentUserEmail, wallet],
  );

  return {
    purchased,
    wallet,
    purchase,
    lookup,
    redeem,
    pickMonth,
  };
}
