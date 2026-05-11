import { AlertTriangle, Loader2, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toSlug } from "../lib/admin";
import type { Concentration, Fragrance, Gender, Note } from "../lib/types";

type Props = {
  initial: Fragrance;
  mode: "create" | "edit";
  existingSlugs: string[];
  onCancel: () => void;
  onSave: (next: Fragrance) => Promise<void> | void;
};

const CONCENTRATIONS: Concentration[] = [
  "Extrait de Parfum",
  "Eau de Parfum",
  "Eau de Toilette",
];

const GENDERS: Gender[] = ["masculine", "feminine", "unisex"];

function notesToText(notes: Note[], family: Note["family"]): string {
  return notes
    .filter((n) => n.family === family)
    .map((n) => n.name)
    .join(", ");
}

function textToNotes(text: string, family: Note["family"]): Note[] {
  return text
    .split(/[,;|/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, family }));
}

function isoToDateInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T23:59:59Z`).toISOString();
}

export default function FragranceForm({
  initial,
  mode,
  existingSlugs,
  onCancel,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Fragrance>(initial);
  const [topText, setTopText] = useState(notesToText(initial.notes, "top"));
  const [heartText, setHeartText] = useState(notesToText(initial.notes, "heart"));
  const [baseText, setBaseText] = useState(notesToText(initial.notes, "base"));
  const [priceUsd, setPriceUsd] = useState(
    initial.priceCents ? (initial.priceCents / 100).toFixed(2) : "",
  );
  const [comparisonUsd, setComparisonUsd] = useState(
    initial.comparisonPriceCents ? (initial.comparisonPriceCents / 100).toFixed(2) : "",
  );
  const [autoSlug, setAutoSlug] = useState(mode === "create");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoSlug) {
      setDraft((d) => ({ ...d, slug: toSlug(d.name) }));
    }
  }, [draft.name, autoSlug]);

  const slugConflict = useMemo(() => {
    if (!draft.slug) return false;
    return existingSlugs.some(
      (s) => s === draft.slug && s !== initial.slug,
    );
  }, [draft.slug, existingSlugs, initial.slug]);

  function set<K extends keyof Fragrance>(key: K, value: Fragrance[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validate(): string | null {
    if (!draft.name.trim()) return "Name is required.";
    if (!draft.slug.trim()) return "Slug is required.";
    if (slugConflict) return "Another fragrance already uses this slug.";
    const price = Number.parseFloat(priceUsd);
    if (!Number.isFinite(price) || price <= 0) return "Price must be greater than 0.";
    if (comparisonUsd) {
      const c = Number.parseFloat(comparisonUsd);
      if (!Number.isFinite(c) || c <= 0) return "Comparison price must be a positive number.";
    }
    if (!Number.isFinite(draft.oilPercent) || draft.oilPercent < 0 || draft.oilPercent > 40) {
      return "Oil % must be between 0 and 40.";
    }
    if (!Number.isFinite(draft.volumeMl) || draft.volumeMl <= 0) return "Volume must be > 0.";
    if (!Number.isFinite(draft.moq) || draft.moq <= 0) return "MOQ must be > 0.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const priceCents = Math.round(Number.parseFloat(priceUsd) * 100);
      const comparisonPriceCents = comparisonUsd
        ? Math.round(Number.parseFloat(comparisonUsd) * 100)
        : undefined;
      const notes: Note[] = [
        ...textToNotes(topText, "top"),
        ...textToNotes(heartText, "heart"),
        ...textToNotes(baseText, "base"),
      ];
      const next: Fragrance = {
        ...draft,
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        inspiration: draft.inspiration.trim(),
        tagline: draft.tagline.trim(),
        story: draft.story.trim(),
        priceCents,
        comparisonPriceCents,
        notes,
      };
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save fragrance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 border border-obsidian-line bg-obsidian-soft/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-obsidian-line px-6 py-4">
        <div>
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
            {mode === "create" ? "New fragrance" : "Edit fragrance"}
          </div>
          <h3 className="mt-1 serif text-2xl text-cream">
            {draft.name || "Untitled fragrance"}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 sans text-[11px] uppercase tracking-[0.26em] text-cream/55 hover:text-gold transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} />
          Close
        </button>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-2">
        <Field label="Name" required>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label={`Slug${autoSlug ? " (auto)" : ""}`}
          required
          hint={slugConflict ? "Slug already in use" : undefined}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.slug}
              onChange={(e) => {
                setAutoSlug(false);
                set("slug", toSlug(e.target.value));
              }}
              className={inputClass}
              required
            />
            {!autoSlug && mode === "create" && (
              <button
                type="button"
                onClick={() => {
                  setAutoSlug(true);
                  set("slug", toSlug(draft.name));
                }}
                className="shrink-0 sans text-[10px] uppercase tracking-[0.22em] text-cream/55 hover:text-gold border border-obsidian-line hover:border-gold/40 px-3 transition-colors"
              >
                Auto
              </button>
            )}
          </div>
        </Field>

        <Field label="Inspiration">
          <input
            type="text"
            placeholder="Inspired by Aventus"
            value={draft.inspiration}
            onChange={(e) => set("inspiration", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tagline">
          <input
            type="text"
            value={draft.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Story" full>
          <textarea
            value={draft.story}
            onChange={(e) => set("story", e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Field label="Concentration">
          <select
            value={draft.concentration}
            onChange={(e) => set("concentration", e.target.value as Concentration)}
            className={inputClass}
          >
            {CONCENTRATIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Gender">
          <select
            value={draft.gender}
            onChange={(e) => set("gender", e.target.value as Gender)}
            className={inputClass}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>

        <Field label="Oil %">
          <input
            type="number"
            min={0}
            max={40}
            value={draft.oilPercent}
            onChange={(e) => set("oilPercent", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Volume (ml)">
          <input
            type="number"
            min={1}
            value={draft.volumeMl}
            onChange={(e) => set("volumeMl", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Price (USD)" required>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Comparison price (USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={comparisonUsd}
            onChange={(e) => setComparisonUsd(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="MOQ">
          <input
            type="number"
            min={1}
            value={draft.moq}
            onChange={(e) => set("moq", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Batch closes">
          <input
            type="date"
            value={isoToDateInput(draft.batchClosesAt)}
            onChange={(e) => set("batchClosesAt", dateInputToIso(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Top notes (comma-separated)" full>
          <input
            type="text"
            value={topText}
            onChange={(e) => setTopText(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heart notes" full>
          <input
            type="text"
            value={heartText}
            onChange={(e) => setHeartText(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Base notes" full>
          <input
            type="text"
            value={baseText}
            onChange={(e) => setBaseText(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Bottle color">
          <ColorInput
            value={draft.bottleColor}
            onChange={(v) => set("bottleColor", v)}
          />
        </Field>
        <Field label="Glass tint">
          <ColorInput
            value={draft.glassTint}
            onChange={(v) => set("glassTint", v)}
          />
        </Field>
        <Field label="Liquid color">
          <ColorInput
            value={draft.liquidColor}
            onChange={(v) => set("liquidColor", v)}
          />
        </Field>
        <Field label="Accent">
          <ColorInput value={draft.accent} onChange={(v) => set("accent", v)} />
        </Field>

        <Field label="VIP only" full>
          <label className="inline-flex items-center gap-2 sans text-[12px] text-cream/75">
            <input
              type="checkbox"
              checked={!!draft.vipOnly}
              onChange={(e) => set("vipOnly", e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            Restrict this fragrance to VIP members.
          </label>
        </Field>
      </div>

      {error && (
        <div className="mx-6 mb-4 inline-flex items-start gap-2 px-4 py-3 border border-rust/60 bg-rust/10 text-rust sans text-[12px]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-obsidian-line px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="bg-obsidian-soft border border-obsidian-line hover:border-gold/40 text-cream px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gold text-obsidian px-6 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft disabled:bg-obsidian-line disabled:text-cream/40 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
          ) : (
            <Save className="h-4 w-4" strokeWidth={1.6} />
          )}
          {mode === "create" ? "Create fragrance" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full bg-obsidian border border-obsidian-line focus:border-gold/60 focus:outline-none text-cream sans text-[13px] px-3 h-10 transition-colors";

function Field({
  label,
  hint,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="sans text-[10px] uppercase tracking-[0.24em] text-cream/55">
          {label}
          {required && <span className="text-gold/80"> *</span>}
        </span>
        {hint && (
          <span className="sans text-[10px] uppercase tracking-[0.22em] text-rust">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 bg-obsidian border border-obsidian-line cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
