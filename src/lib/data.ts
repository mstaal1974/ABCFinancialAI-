import type { Fragrance } from "./types";

// Seed catalogue. In production, sourced from Supabase `fragrances` table.
// Prices in cents (USD). Volumes in ml.
export const FRAGRANCES: Fragrance[] = [
  {
    id: "f-001",
    slug: "obsidian-no-1",
    name: "Obsidian No. 1",
    inspiration: "Inspired by Aventus",
    tagline: "Smoked pineapple, birch, ambergris.",
    story:
      "A signature opening of Sicilian pineapple charred over Laotian oud smoke. Heart of birch tar and rose absolute settles into a base of ambergris and mossy oakmoss. Bold, executive, unmistakable.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 18500,
    moq: 20,
    committed: 12,
    batchClosesAt: "2026-06-15T23:59:59Z",
    notes: [
      { name: "Pineapple", family: "top" },
      { name: "Bergamot", family: "top" },
      { name: "Black Currant", family: "top" },
      { name: "Birch Tar", family: "heart" },
      { name: "Rose Absolute", family: "heart" },
      { name: "Patchouli", family: "heart" },
      { name: "Ambergris", family: "base" },
      { name: "Oakmoss", family: "base" },
      { name: "Vanilla", family: "base" },
    ],
    bottleColor: "#0e0e12",
    glassTint: "#1a1a22",
    liquidColor: "#3b2a18",
    accent: "#c9a961",
  },
  {
    id: "f-002",
    slug: "noir-imperial",
    name: "Noir Impérial",
    inspiration: "Inspired by Tom Ford Tobacco Vanille",
    tagline: "Pipe tobacco, cocoa, dried fig.",
    story:
      "An aged tobacco leaf wrapped in vanilla orchid and Madagascan cocoa. Dried fig and tonka bean linger like the embers of a private library long after midnight.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 19500,
    moq: 25,
    committed: 19,
    batchClosesAt: "2026-06-10T23:59:59Z",
    notes: [
      { name: "Spicy Tobacco", family: "top" },
      { name: "Cardamom", family: "top" },
      { name: "Tonka Bean", family: "heart" },
      { name: "Cocoa", family: "heart" },
      { name: "Dried Fig", family: "heart" },
      { name: "Vanilla Orchid", family: "base" },
      { name: "Sandalwood", family: "base" },
    ],
    bottleColor: "#0a0a0c",
    glassTint: "#1c1408",
    liquidColor: "#5a3514",
    accent: "#c9a961",
  },
  {
    id: "f-003",
    slug: "saffron-vellum",
    name: "Saffron Vellum",
    inspiration: "Inspired by Baccarat Rouge 540",
    tagline: "Saffron, jasmine, ambered woods.",
    story:
      "Persian saffron threads steeped in jasmine sambac, suspended over a glowing base of cedar and ambergris. A scent that signs the air around you in gold leaf.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 21500,
    moq: 30,
    committed: 30, // batch met!
    batchClosesAt: "2026-05-28T23:59:59Z",
    notes: [
      { name: "Saffron", family: "top" },
      { name: "Jasmine Sambac", family: "heart" },
      { name: "Egyptian Jasmine", family: "heart" },
      { name: "Ambergris", family: "base" },
      { name: "Cedar", family: "base" },
      { name: "Fir Resin", family: "base" },
    ],
    bottleColor: "#100806",
    glassTint: "#2b1208",
    liquidColor: "#a04a1c",
    accent: "#d9b370",
  },
  {
    id: "f-004",
    slug: "atelier-rose",
    name: "Atelier Rose",
    inspiration: "Inspired by Roses on Ice",
    tagline: "Taif rose, lychee, frozen oud.",
    story:
      "A glacial bouquet of Taif rose laid over chilled lychee and a whisper of Hindi oud. Romantic without being sweet — the floral equivalent of a black silk dress.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 19000,
    moq: 20,
    committed: 7,
    batchClosesAt: "2026-07-01T23:59:59Z",
    vipOnly: true,
    notes: [
      { name: "Lychee", family: "top" },
      { name: "Pink Pepper", family: "top" },
      { name: "Taif Rose", family: "heart" },
      { name: "Bulgarian Rose", family: "heart" },
      { name: "White Oud", family: "base" },
      { name: "White Musk", family: "base" },
    ],
    bottleColor: "#120a0d",
    glassTint: "#2a1218",
    liquidColor: "#9c4660",
    accent: "#e0b884",
  },
  {
    id: "f-005",
    slug: "khaleeji-oud",
    name: "Khaleeji Oud",
    inspiration: "Inspired by Initio Oud for Greatness",
    tagline: "Lavender, oud, saffron smoke.",
    story:
      "A diplomat's signature. Bright lavender folds into smoked saffron and a column of Cambodian oud, anchored with patchouli that lingers on cashmere for days.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 22500,
    moq: 25,
    committed: 22,
    batchClosesAt: "2026-06-20T23:59:59Z",
    notes: [
      { name: "Lavender", family: "top" },
      { name: "Nutmeg", family: "top" },
      { name: "Saffron", family: "heart" },
      { name: "Cambodian Oud", family: "heart" },
      { name: "Patchouli", family: "base" },
      { name: "Musk", family: "base" },
    ],
    bottleColor: "#070708",
    glassTint: "#161018",
    liquidColor: "#2c1a0c",
    accent: "#c9a961",
  },
  {
    id: "f-006",
    slug: "bleu-marbre",
    name: "Bleu Marbre",
    inspiration: "Inspired by Bleu de Chanel",
    tagline: "Citron, ginger, sandalwood.",
    story:
      "Mediterranean citron and pink pepper rise off icy ginger; a heart of nutmeg leads into sandalwood, cedar and a column of clean white musk. Effortless, year round.",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 17500,
    moq: 20,
    committed: 5,
    batchClosesAt: "2026-07-12T23:59:59Z",
    notes: [
      { name: "Citron", family: "top" },
      { name: "Pink Pepper", family: "top" },
      { name: "Ginger", family: "top" },
      { name: "Nutmeg", family: "heart" },
      { name: "Jasmine", family: "heart" },
      { name: "Sandalwood", family: "base" },
      { name: "Cedar", family: "base" },
      { name: "White Musk", family: "base" },
    ],
    bottleColor: "#06080c",
    glassTint: "#0c1422",
    liquidColor: "#1f3a5e",
    accent: "#c9a961",
  },
];

export function findFragrance(slug: string): Fragrance | undefined {
  return FRAGRANCES.find((f) => f.slug === slug);
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
