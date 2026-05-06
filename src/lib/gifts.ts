import { useCallback, useEffect, useState } from "react";
import type { GiftCard } from "./types";
import { isSupabaseEnabled, supabase } from "./supabase";

const PURCHASED_KEY = "mo:gifts-purchased:v1";   // codes the current user bought
const WALLET_KEY = "mo:gifts-wallet:v1";         // codes the current user redeemed

// Fixed-amount presets shown in the gift purchase UI. Custom amounts allowed.
export const GIFT_PRESETS = [
  { cents: 3500,  label: "Sample Box",      sub: "5 vials, 2 ml each" },
  { cents: 18500, label: "One Bottle",      sub: "30% Extrait, 50 ml" },
  { cents: 22500, label: "Signature",       sub: "Top of the catalogue" },
  { cents: 50000, label: "The Atelier",     sub: "Multiple bottles, the works" },
];

export const GIFT_MIN_CENTS = 2000;
export const GIFT_MAX_CENTS = 200_000;

/** Generates a "MO-XXXX-XXXX" code (no I/O/0/1 to keep human readable). */
function newGiftCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `MO-${rand(4)}-${rand(4)}`;
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
    /* ignore quota */
  }
}

export type PurchaseGiftInput = {
  amountCents: number;
  senderName: string;
  senderEmail: string | null;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  scheduledFor: string | null;
};

/**
 * Gift cards: sender purchases a value, recipient redeems via a code/link
 * and the balance is applied against any future commit or sample box.
 *
 * Backed by Supabase when configured; otherwise persists to localStorage so
 * the demo UX works offline. The `wallet` is the set of redeemed cards
 * belonging to the current user (we key by recipient email).
 */
export function useGifts(currentUserEmail: string | null) {
  const [purchased, setPurchased] = useState<GiftCard[]>(() =>
    readJSON<GiftCard[]>(PURCHASED_KEY, []),
  );
  const [wallet, setWallet] = useState<GiftCard[]>(() =>
    readJSON<GiftCard[]>(WALLET_KEY, []),
  );

  useEffect(() => writeJSON(PURCHASED_KEY, purchased), [purchased]);
  useEffect(() => writeJSON(WALLET_KEY, wallet), [wallet]);

  const balanceCents = wallet.reduce(
    (sum, g) => sum + (g.status === "spent" ? 0 : g.balanceCents),
    0,
  );

  const purchase = useCallback(
    async (input: PurchaseGiftInput): Promise<GiftCard> => {
      const card: GiftCard = {
        id: crypto.randomUUID(),
        code: newGiftCode(),
        amountCents: input.amountCents,
        balanceCents: input.amountCents,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        message: input.message?.trim() ? input.message.trim() : null,
        status: "active",
        scheduledFor: input.scheduledFor,
        createdAt: new Date().toISOString(),
        redeemedAt: null,
        redeemedByEmail: null,
      };
      // In production this would post to a server route that:
      //   1. charges the buyer's card via Stripe (capture immediate),
      //   2. inserts the row server-side with a service-role key,
      //   3. enqueues the recipient email + scheduled send.
      if (isSupabaseEnabled && supabase) {
        try {
          await supabase.from("gift_cards").insert({
            id: card.id,
            code: card.code,
            amount_cents: card.amountCents,
            balance_cents: card.balanceCents,
            sender_name: card.senderName,
            sender_email: card.senderEmail,
            recipient_name: card.recipientName,
            recipient_email: card.recipientEmail,
            message: card.message,
            status: card.status,
            scheduled_for: card.scheduledFor,
          });
        } catch {
          /* offline — fine for MVP demo */
        }
      }
      setPurchased((prev) => [card, ...prev]);
      return card;
    },
    [],
  );

  /**
   * Look up a code from the local store (purchased cards) — and from
   * Supabase if available. Used by the redemption page so a recipient
   * arriving from a link can see the gift before signing in.
   */
  const lookup = useCallback(
    async (code: string): Promise<GiftCard | null> => {
      const trimmed = code.trim().toUpperCase();
      const local =
        purchased.find((c) => c.code === trimmed) ??
        wallet.find((c) => c.code === trimmed);
      if (local) return local;
      if (isSupabaseEnabled && supabase) {
        try {
          const { data } = await supabase
            .from("gift_cards")
            .select("*")
            .eq("code", trimmed)
            .maybeSingle();
          if (data) {
            return {
              id: data.id,
              code: data.code,
              amountCents: data.amount_cents,
              balanceCents: data.balance_cents,
              senderName: data.sender_name,
              senderEmail: data.sender_email,
              recipientName: data.recipient_name,
              recipientEmail: data.recipient_email,
              message: data.message,
              status: data.status,
              scheduledFor: data.scheduled_for,
              createdAt: data.created_at,
              redeemedAt: data.redeemed_at,
              redeemedByEmail: data.redeemed_by_email,
            };
          }
        } catch {
          /* fall through */
        }
      }
      return null;
    },
    [purchased, wallet],
  );

  /** Recipient redeems a code: moves the card into the user's wallet. */
  const redeem = useCallback(
    async (code: string): Promise<{ ok: true; card: GiftCard } | { ok: false; error: string }> => {
      if (!currentUserEmail) {
        return { ok: false, error: "Sign in to redeem this gift card." };
      }
      const found = await lookup(code);
      if (!found) return { ok: false, error: "We couldn't find that code." };
      if (found.status === "spent") {
        return { ok: false, error: "This gift card has already been spent." };
      }
      if (wallet.some((c) => c.id === found.id)) {
        return { ok: false, error: "You've already redeemed this card." };
      }

      const claimed: GiftCard = {
        ...found,
        status: "redeemed",
        redeemedAt: new Date().toISOString(),
        redeemedByEmail: currentUserEmail,
      };
      if (isSupabaseEnabled && supabase) {
        try {
          await supabase
            .from("gift_cards")
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
      setWallet((prev) => [claimed, ...prev]);
      return { ok: true, card: claimed };
    },
    [currentUserEmail, lookup, wallet],
  );

  /**
   * Apply gift balance to an order (commit or sample box). Returns how
   * much was covered by gift credit and how much still needs the buyer's
   * card. Mutates the wallet in place — oldest cards spent first.
   */
  const applyBalance = useCallback(
    async (amountCents: number): Promise<{ giftCents: number; chargeCents: number }> => {
      if (amountCents <= 0 || balanceCents <= 0) {
        return { giftCents: 0, chargeCents: amountCents };
      }
      let remaining = amountCents;
      const next: GiftCard[] = [];
      const updates: Pick<GiftCard, "id" | "balanceCents" | "status">[] = [];
      for (const card of wallet) {
        if (remaining <= 0 || card.status === "spent") {
          next.push(card);
          continue;
        }
        const take = Math.min(card.balanceCents, remaining);
        const newBalance = card.balanceCents - take;
        const newStatus: GiftCard["status"] = newBalance === 0 ? "spent" : "redeemed";
        next.push({ ...card, balanceCents: newBalance, status: newStatus });
        updates.push({ id: card.id, balanceCents: newBalance, status: newStatus });
        remaining -= take;
      }
      const giftCents = amountCents - remaining;
      setWallet(next);

      if (isSupabaseEnabled && supabase && updates.length > 0) {
        try {
          await Promise.all(
            updates.map((u) =>
              supabase!
                .from("gift_cards")
                .update({ balance_cents: u.balanceCents, status: u.status })
                .eq("id", u.id),
            ),
          );
        } catch {
          /* offline */
        }
      }

      return { giftCents, chargeCents: remaining };
    },
    [balanceCents, wallet],
  );

  return {
    purchased,
    wallet,
    balanceCents,
    purchase,
    redeem,
    lookup,
    applyBalance,
  };
}
