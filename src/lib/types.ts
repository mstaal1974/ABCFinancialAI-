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

export type GiftSubscriptionPlanMonths = 3 | 6 | 12;

export type GiftSubscriptionStatus =
  | "active"      // purchased, awaiting redemption
  | "redeemed"    // recipient has claimed it; picks may be in progress
  | "completed"   // every monthly pick has been made
  | "cancelled";

export type GiftSubscriptionPick = {
  id: string;
  subscriptionId: string;
  monthIndex: number;       // 1..planMonths
  fragranceId: string;
  pickedAt: string;
  shipAt: string | null;
  status: "queued" | "shipped" | "cancelled";
};

export type GiftSubscription = {
  id: string;
  code: string;              // human-readable, e.g. "MO-SUB-7K3X"
  planMonths: GiftSubscriptionPlanMonths;
  priceCents: number;
  status: GiftSubscriptionStatus;
  senderName: string;
  senderEmail: string | null;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  scheduledFor: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  picks: GiftSubscriptionPick[];
};

export type ShipmentSourceType = "commit" | "sample_box" | "subscription_pick";

export type ShipmentStatus =
  | "pending"     // order placed, not yet packed
  | "packed"      // packed in the studio, awaiting carrier pickup
  | "shipped"     // handed to carrier, tracking number live
  | "delivered"   // carrier confirms delivery
  | "cancelled";  // off-path terminal state

export type Shipment = {
  id: string;
  sourceType: ShipmentSourceType;
  sourceId: string;
  userId: string | null;
  userEmail: string | null;
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  notes: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
