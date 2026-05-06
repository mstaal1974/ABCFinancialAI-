import * as XLSX from "xlsx";
import type { Fragrance, Gender, Note } from "./types";
import { isSupabaseEnabled, supabase } from "./supabase";

/** Header aliases (case-insensitive). The first matching alias wins. */
const HEADER_ALIASES: Record<keyof RawRow, string[]> = {
  sex: ["sex", "gender"],
  name: ["scent name", "name", "fragrance", "fragrance name"],
  inspiration: ["inspired by", "inspiration", "inspired-by"],
  description: ["description", "tagline", "story", "notes description"],
  topNotes: ["top notes", "top", "head notes"],
  heartNotes: ["heart notes", "heart", "middle notes", "mid notes"],
  baseNotes: ["base notes", "base", "dry-down", "drydown", "base note"],
  price: ["price", "our price", "boutique price"],
  comparison: ["comparison", "compared to", "designer price", "retail"],
};

type RawRow = {
  sex?: string;
  name?: string;
  inspiration?: string;
  description?: string;
  topNotes?: string;
  heartNotes?: string;
  baseNotes?: string;
  price?: string;
  comparison?: string;
};

export type ParsedRow = {
  /** 1-indexed row number from the source sheet (after header row). */
  rowNumber: number;
  /** Full normalized fragrance candidate ready for upsert. */
  candidate: Fragrance;
  /** Soft warnings — row still importable. */
  warnings: string[];
  /** Hard errors — row will not be imported. */
  errors: string[];
};

const VISUAL_PALETTE: Pick<
  Fragrance,
  "bottleColor" | "glassTint" | "liquidColor" | "accent"
>[] = [
  { bottleColor: "#0e0e12", glassTint: "#1a1a22", liquidColor: "#3b2a18", accent: "#c9a961" },
  { bottleColor: "#0a0a0c", glassTint: "#1c1408", liquidColor: "#5a3514", accent: "#c9a961" },
  { bottleColor: "#100806", glassTint: "#2b1208", liquidColor: "#a04a1c", accent: "#d9b370" },
  { bottleColor: "#120a0d", glassTint: "#2a1218", liquidColor: "#9c4660", accent: "#e0b884" },
  { bottleColor: "#070708", glassTint: "#161018", liquidColor: "#2c1a0c", accent: "#c9a961" },
  { bottleColor: "#06080c", glassTint: "#0c1422", liquidColor: "#1f3a5e", accent: "#c9a961" },
  { bottleColor: "#1a0d10", glassTint: "#311722", liquidColor: "#b8627c", accent: "#e3bf7a" },
  { bottleColor: "#0c0a14", glassTint: "#1d1830", liquidColor: "#5b3b86", accent: "#d6b66f" },
  { bottleColor: "#050608", glassTint: "#0d141c", liquidColor: "#13344f", accent: "#c9a961" },
];

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function moneyToCents(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseGender(value: string | undefined): Gender {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "men" || v === "man" || v === "male" || v === "masculine" || v === "m" || v === "him") {
    return "masculine";
  }
  if (v === "women" || v === "woman" || v === "female" || v === "feminine" || v === "f" || v === "her") {
    return "feminine";
  }
  return "unisex";
}

function splitNotes(value: string | undefined, family: Note["family"]): Note[] {
  if (!value) return [];
  return String(value)
    .split(/[,;|/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name, family }));
}

function buildHeaderMap(headers: string[]): Partial<Record<keyof RawRow, number>> {
  const lower = headers.map((h) => String(h ?? "").trim().toLowerCase());
  const out: Partial<Record<keyof RawRow, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as (keyof RawRow)[]) {
    const aliases = HEADER_ALIASES[key];
    const idx = lower.findIndex((h) => aliases.includes(h));
    if (idx !== -1) out[key] = idx;
  }
  return out;
}

function normalizeRow(
  raw: RawRow,
  rowNumber: number,
  visualIndex: number,
): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = (raw.name ?? "").trim();
  if (!name) errors.push("Missing fragrance name");

  const description = (raw.description ?? "").trim();
  const inspirationRaw = (raw.inspiration ?? "").trim();
  const inspiration = inspirationRaw
    ? /^inspired by/i.test(inspirationRaw)
      ? inspirationRaw
      : `Inspired by ${inspirationRaw}`
    : "";
  if (!inspirationRaw) warnings.push("No 'Inspired by' value — using a placeholder");

  const priceCents = moneyToCents(raw.price);
  if (priceCents === null) errors.push("Missing or invalid Price");

  const comparisonPriceCents = moneyToCents(raw.comparison) ?? undefined;

  const notes: Note[] = [
    ...splitNotes(raw.topNotes, "top"),
    ...splitNotes(raw.heartNotes, "heart"),
    ...splitNotes(raw.baseNotes, "base"),
  ];
  if (notes.length === 0) warnings.push("No fragrance notes parsed");

  const tagline =
    notes.slice(0, 3).map((n) => n.name).join(", ") +
    (notes.length > 0 ? "." : description.split(/[.!?]/)[0]?.trim() ?? "");

  const visuals = VISUAL_PALETTE[visualIndex % VISUAL_PALETTE.length];
  const slug = name ? slugify(name) : `fragrance-${rowNumber}`;

  const candidate: Fragrance = {
    id: `imp-${slug}`,
    slug,
    name: name || `Fragrance ${rowNumber}`,
    inspiration: inspiration || "Inspired by a private blend",
    tagline: (tagline || description).slice(0, 120),
    story: description || tagline || `${name} — a Maison Obsidian pour.`,
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: priceCents ?? 0,
    comparisonPriceCents,
    gender: parseGender(raw.sex),
    moq: 20,
    committed: 0,
    batchClosesAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    notes,
    bottleColor: visuals.bottleColor,
    glassTint: visuals.glassTint,
    liquidColor: visuals.liquidColor,
    accent: visuals.accent,
  };

  return { rowNumber, candidate, warnings, errors };
}

/**
 * Parse an uploaded XLSX/XLS/CSV file. Reads the first sheet, finds the
 * header row, and returns one normalized fragrance candidate per data row.
 */
export async function parseFragranceFile(file: File): Promise<{
  rows: ParsedRow[];
  headers: string[];
  unmappedHeaders: string[];
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    throw new Error("The uploaded file has no readable sheet.");
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (matrix.length === 0) {
    throw new Error("The sheet is empty.");
  }

  const headers = matrix[0].map((c) => String(c ?? "").trim());
  const map = buildHeaderMap(headers);

  const required: (keyof RawRow)[] = ["name", "price"];
  const missing = required.filter((k) => map[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}. Found: ${headers.join(", ")}`,
    );
  }

  const knownIndices = new Set(
    Object.values(map).filter((v): v is number => typeof v === "number"),
  );
  const unmappedHeaders = headers.filter((_h, i) => !knownIndices.has(i) && headers[i] !== "");

  const rows: ParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;
    const raw: RawRow = {
      sex:         pickCell(row, map.sex),
      name:        pickCell(row, map.name),
      inspiration: pickCell(row, map.inspiration),
      description: pickCell(row, map.description),
      topNotes:    pickCell(row, map.topNotes),
      heartNotes:  pickCell(row, map.heartNotes),
      baseNotes:   pickCell(row, map.baseNotes),
      price:       pickCell(row, map.price),
      comparison:  pickCell(row, map.comparison),
    };
    rows.push(normalizeRow(raw, r, rows.length));
  }

  return { rows, headers, unmappedHeaders };
}

function pickCell(row: unknown[], idx: number | undefined): string | undefined {
  if (idx === undefined) return undefined;
  const v = row[idx];
  if (v === undefined || v === null) return undefined;
  return typeof v === "string" ? v : String(v);
}

/**
 * Upsert parsed candidates into Supabase. Returns counts. When Supabase
 * is unreachable, the caller can still patch the in-memory catalogue —
 * see `applyToCatalogue` below.
 */
export async function upsertFragrances(rows: ParsedRow[]): Promise<{
  inserted: number;
  failed: number;
}> {
  const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.candidate);
  if (valid.length === 0) return { inserted: 0, failed: rows.length };
  if (!isSupabaseEnabled || !supabase) {
    return { inserted: 0, failed: 0 };
  }
  const payload = valid.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    inspiration: f.inspiration,
    tagline: f.tagline,
    story: f.story,
    concentration: f.concentration,
    oil_percent: f.oilPercent,
    volume_ml: f.volumeMl,
    price_cents: f.priceCents,
    comparison_price_cents: f.comparisonPriceCents ?? null,
    gender: f.gender,
    moq: f.moq,
    committed: f.committed,
    batch_closes_at: f.batchClosesAt,
    vip_only: !!f.vipOnly,
  }));
  const { error } = await supabase.from("fragrances").upsert(payload, {
    onConflict: "slug",
  });
  if (error) {
    return { inserted: 0, failed: valid.length };
  }
  return { inserted: valid.length, failed: rows.length - valid.length };
}

/** Patch a Fragrance[] in memory with imported candidates (slug-keyed). */
export function applyToCatalogue(
  current: Fragrance[],
  rows: ParsedRow[],
): Fragrance[] {
  const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.candidate);
  const bySlug = new Map(current.map((f) => [f.slug, f]));
  for (const f of valid) {
    const prior = bySlug.get(f.slug);
    bySlug.set(f.slug, prior ? { ...prior, ...f, id: prior.id, committed: prior.committed } : f);
  }
  return Array.from(bySlug.values());
}

/** Convert a Fragrance object to the snake_case Supabase row payload. */
function toFragranceRow(f: Fragrance) {
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    inspiration: f.inspiration,
    tagline: f.tagline,
    story: f.story,
    concentration: f.concentration,
    oil_percent: f.oilPercent,
    volume_ml: f.volumeMl,
    price_cents: f.priceCents,
    comparison_price_cents: f.comparisonPriceCents ?? null,
    gender: f.gender,
    moq: f.moq,
    committed: f.committed,
    batch_closes_at: f.batchClosesAt,
    vip_only: !!f.vipOnly,
  };
}

/** Default visual palette for a brand-new fragrance. */
export function blankFragrance(): Fragrance {
  const visuals = VISUAL_PALETTE[0];
  const id = `imp-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    slug: "",
    name: "",
    inspiration: "",
    tagline: "",
    story: "",
    concentration: "Extrait de Parfum",
    oilPercent: 30,
    volumeMl: 50,
    priceCents: 0,
    comparisonPriceCents: undefined,
    gender: "unisex",
    moq: 20,
    committed: 0,
    batchClosesAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    notes: [],
    bottleColor: visuals.bottleColor,
    glassTint: visuals.glassTint,
    liquidColor: visuals.liquidColor,
    accent: visuals.accent,
    vipOnly: false,
  };
}

/** Slugify a string (re-exported helper for the form). */
export function toSlug(s: string): string {
  return slugify(s);
}

/**
 * Insert a new fragrance row. Returns the saved fragrance (with any
 * server-derived defaults) when Supabase is connected, or the local
 * candidate when running in demo mode.
 */
export async function createFragrance(f: Fragrance): Promise<Fragrance> {
  if (!isSupabaseEnabled || !supabase) return f;
  const { error } = await supabase.from("fragrances").insert(toFragranceRow(f));
  if (error) throw new Error(error.message);
  return f;
}

/** Update an existing fragrance, matched by id. */
export async function updateFragrance(f: Fragrance): Promise<Fragrance> {
  if (!isSupabaseEnabled || !supabase) return f;
  const { error } = await supabase
    .from("fragrances")
    .update(toFragranceRow(f))
    .eq("id", f.id);
  if (error) throw new Error(error.message);
  return f;
}

/** Delete a fragrance by id. */
export async function deleteFragrance(id: string): Promise<void> {
  if (!isSupabaseEnabled || !supabase) return;
  const { error } = await supabase.from("fragrances").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
