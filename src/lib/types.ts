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
