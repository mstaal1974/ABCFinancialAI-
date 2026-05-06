export type Concentration = "Extrait de Parfum" | "Eau de Parfum" | "Eau de Toilette";

export type Gender = "masculine" | "feminine" | "unisex";

export type Note = {
  name: string;
  family: "top" | "heart" | "base";
};

export type Fragrance = {
  id: string;
  slug: string;
  name: string;
  inspiration: string; // e.g. "Inspired by Aventus"
  tagline: string;
  story: string;
  concentration: Concentration;
  oilPercent: number; // e.g. 30
  volumeMl: number;
  priceCents: number;
  /** Designer fragrance reference price for comparison (optional). */
  comparisonPriceCents?: number;
  gender: Gender;
  // Batch system
  moq: number;            // minimum order quantity to ship
  committed: number;      // current commits
  batchClosesAt: string;  // ISO date — fallback close even if MOQ not met
  // Composition
  notes: Note[];
  // Visuals
  bottleColor: string;    // CSS color used in the bottle SVG
  glassTint: string;      // overlay tint
  liquidColor: string;
  accent: string;         // gold variant accent
  vipOnly?: boolean;      // VIP early access?
};

export type Commit = {
  id: string;
  fragranceId: string;
  customLabel: string | null;
  createdAt: string;
  // Stripe authorize-now / capture-later metadata (stub)
  paymentIntentId: string;
  status: "authorized" | "captured" | "released" | "void";
};

export type Subscriber = {
  email: string;
  tier: "general" | "vip";
  createdAt: string;
};

export type GiftCardStatus = "active" | "redeemed" | "spent" | "expired";

export type GiftCard = {
  id: string;
  code: string;              // human-readable, e.g. "MO-7K3X-PRZ8"
  amountCents: number;       // original face value
  balanceCents: number;      // remaining credit after redemptions
  senderName: string;
  senderEmail: string | null;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  status: GiftCardStatus;
  scheduledFor: string | null; // ISO — null = send now
  createdAt: string;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
};
