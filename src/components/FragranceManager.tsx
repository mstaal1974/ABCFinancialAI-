import { AlertTriangle, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  blankFragrance,
  createFragrance,
  deleteFragrance,
  updateFragrance,
} from "../lib/admin";
import { formatPrice } from "../lib/data";
import { isSupabaseEnabled } from "../lib/supabase";
import type { Fragrance } from "../lib/types";
import FragranceForm from "./FragranceForm";

type Props = {
  fragrances: Fragrance[];
  onCatalogueUpdated: (next: Fragrance[]) => void;
};

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; id: string }
  | { kind: "deleting"; id: string };

export default function FragranceManager({
  fragrances,
  onCatalogueUpdated,
}: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fragrances;
    return fragrances.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        f.inspiration.toLowerCase().includes(q),
    );
  }, [fragrances, query]);

  const editing =
    mode.kind === "edit" ? fragrances.find((f) => f.id === mode.id) ?? null : null;

  async function handleCreate(next: Fragrance) {
    setError(null);
    const saved = await createFragrance(next);
    onCatalogueUpdated([...fragrances, saved]);
    setMode({ kind: "list" });
  }

  async function handleUpdate(next: Fragrance) {
    setError(null);
    const saved = await updateFragrance(next);
    onCatalogueUpdated(fragrances.map((f) => (f.id === saved.id ? saved : f)));
    setMode({ kind: "list" });
  }

  async function handleDelete(id: string) {
    const target = fragrances.find((f) => f.id === id);
    if (!target) return;
    const confirmed = window.confirm(
      `Delete "${target.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteFragrance(id);
      onCatalogueUpdated(fragrances.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete fragrance.");
    } finally {
      setBusyId(null);
    }
  }

  if (mode.kind === "create") {
    return (
      <FragranceForm
        mode="create"
        initial={blankFragrance()}
        existingSlugs={fragrances.map((f) => f.slug)}
        onCancel={() => setMode({ kind: "list" })}
        onSave={handleCreate}
      />
    );
  }

  if (mode.kind === "edit" && editing) {
    return (
      <FragranceForm
        mode="edit"
        initial={editing}
        existingSlugs={fragrances.map((f) => f.slug)}
        onCancel={() => setMode({ kind: "list" })}
        onSave={handleUpdate}
      />
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
            Catalogue · {fragrances.length} fragrances
          </div>
          <h2 className="mt-2 serif text-3xl text-cream">
            Edit, delete, or add a fragrance.
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/35"
              strokeWidth={1.6}
            />
            <input
              type="text"
              placeholder="Search name, slug, inspiration"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 bg-obsidian border border-obsidian-line focus:border-gold/60 focus:outline-none text-cream sans text-[13px] pl-9 pr-3 h-11 transition-colors"
            />
          </div>
          <button
            onClick={() => setMode({ kind: "create" })}
            className="inline-flex items-center gap-2 bg-gold text-obsidian px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft transition-colors"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            New fragrance
          </button>
        </div>
      </div>

      {!isSupabaseEnabled && (
        <div className="mt-6 sans text-[12px] text-cream/55 px-1">
          Supabase isn't configured in this build — edits are kept in-memory only and revert on refresh.
        </div>
      )}

      {error && (
        <div className="mt-6 inline-flex items-start gap-2 px-4 py-3 border border-rust/60 bg-rust/10 text-rust sans text-[12px]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 overflow-x-auto border border-obsidian-line">
        <table className="w-full sans text-[13px] text-cream/80">
          <thead className="bg-obsidian-soft text-cream/55 sans text-[10px] uppercase tracking-[0.22em]">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-left px-4 py-3">Gender</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">MOQ</th>
              <th className="text-right px-4 py-3">Committed</th>
              <th className="text-right px-4 py-3 w-44">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-cream/45 sans text-[12px] uppercase tracking-[0.22em]"
                >
                  {query ? "No fragrances match your search." : "No fragrances yet."}
                </td>
              </tr>
            )}
            {filtered.map((f) => (
              <tr key={f.id} className="border-t border-obsidian-line hover:bg-obsidian-soft/40">
                <td className="px-4 py-3">
                  <div className="serif text-cream text-base">{f.name}</div>
                  <div className="text-cream/45 text-[11px] mt-0.5">
                    {f.inspiration}
                  </div>
                </td>
                <td className="px-4 py-3 text-cream/60 font-mono text-[12px]">{f.slug}</td>
                <td className="px-4 py-3 capitalize text-gold/85">{f.gender}</td>
                <td className="px-4 py-3 text-right text-gold tabular-nums">
                  {formatPrice(f.priceCents)}
                </td>
                <td className="px-4 py-3 text-right text-cream/65 tabular-nums">{f.moq}</td>
                <td className="px-4 py-3 text-right text-cream/65 tabular-nums">
                  {f.committed}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setMode({ kind: "edit", id: f.id })}
                      className="inline-flex items-center gap-1.5 border border-obsidian-line hover:border-gold/50 text-cream px-3 h-9 sans text-[10px] uppercase tracking-[0.24em] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={busyId === f.id}
                      className="inline-flex items-center gap-1.5 border border-rust/40 hover:border-rust text-rust px-3 h-9 sans text-[10px] uppercase tracking-[0.24em] hover:bg-rust/10 disabled:opacity-50 transition-colors"
                    >
                      {busyId === f.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      )}
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
