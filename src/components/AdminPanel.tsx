import { AlertTriangle, ArrowLeft, Check, Database, FileSpreadsheet, Loader2, Pencil, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  type ParsedRow,
  applyToCatalogue,
  parseFragranceFile,
  upsertFragrances,
} from "../lib/admin";
import type { AuthUser } from "../lib/auth";
import { formatPrice } from "../lib/data";
import { isSupabaseEnabled } from "../lib/supabase";
import type { Fragrance } from "../lib/types";
import FragranceManager from "./FragranceManager";

type Tab = "manage" | "import";

type Props = {
  user: AuthUser | null;
  fragrances: Fragrance[];
  onCatalogueUpdated: (next: Fragrance[]) => void;
  onBack: () => void;
  onRequireAuth: () => void;
};

type Stage =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "preview"; rows: ParsedRow[]; headers: string[]; unmappedHeaders: string[]; fileName: string }
  | { kind: "uploading" }
  | { kind: "done"; inserted: number; failed: number; rows: ParsedRow[] }
  | { kind: "error"; message: string };

export default function AdminPanel({
  user,
  fragrances,
  onCatalogueUpdated,
  onBack,
  onRequireAuth,
}: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [tab, setTab] = useState<Tab>("manage");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStage({ kind: "parsing" });
    try {
      const { rows, headers, unmappedHeaders } = await parseFragranceFile(file);
      setStage({ kind: "preview", rows, headers, unmappedHeaders, fileName: file.name });
    } catch (e) {
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Could not parse the file.",
      });
    }
  }

  async function handleConfirm() {
    if (stage.kind !== "preview") return;
    if (!user) {
      onRequireAuth();
      return;
    }
    setStage({ kind: "uploading" });
    try {
      const { inserted, failed } = await upsertFragrances(stage.rows);
      const next = applyToCatalogue(fragrances, stage.rows);
      onCatalogueUpdated(next);
      setStage({ kind: "done", inserted, failed, rows: stage.rows });
    } catch (e) {
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Upload failed.",
      });
    }
  }

  function reset() {
    setStage({ kind: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-16">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 sans text-[11px] uppercase tracking-[0.28em] text-cream/60 hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Back to the storefront
        </button>

        <div className="mt-8 flex items-end justify-between gap-6 border-b border-obsidian-line pb-8">
          <div>
            <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
              Atelier Admin · Catalogue
            </div>
            <h1 className="mt-3 serif text-4xl lg:text-5xl text-cream">
              {tab === "manage"
                ? "Curate the Vault, fragrance by fragrance."
                : "Update the Vault from a spreadsheet."}
            </h1>
            <p className="mt-3 sans text-[14px] text-cream/60 max-w-2xl leading-relaxed">
              {tab === "manage" ? (
                <>
                  Add a new pour, edit an existing fragrance, or retire one
                  from the catalogue. Changes sync to Supabase when connected.
                </>
              ) : (
                <>
                  Upload an Excel or CSV file with one fragrance per row.
                  Required columns: <code className="text-gold">Scent Name</code>,
                  <code className="text-gold ml-1">Price</code>. Optional:{" "}
                  <span className="text-cream/80">
                    Sex, Inspired by, Description, Top notes, Heart notes,
                    Base notes, Comparison.
                  </span>{" "}
                  Existing fragrances are matched by slug and updated in place.
                </>
              )}
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 sans text-[11px] uppercase tracking-[0.22em] text-cream/55">
            <span>
              Live catalogue:{" "}
              <span className="text-gold tabular-nums">{fragrances.length}</span>{" "}
              fragrances
            </span>
            <span
              className={`flex items-center gap-1.5 ${
                isSupabaseEnabled ? "text-gold" : "text-cream/40"
              }`}
            >
              <Database className="h-3.5 w-3.5" strokeWidth={1.5} />
              {isSupabaseEnabled ? "Supabase connected" : "Demo only"}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-1 border-b border-obsidian-line">
          <TabButton
            active={tab === "manage"}
            onClick={() => setTab("manage")}
            icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />}
            label="Manage individually"
          />
          <TabButton
            active={tab === "import"}
            onClick={() => setTab("import")}
            icon={<FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.6} />}
            label="Bulk import"
          />
        </div>

        {tab === "manage" && (
          <FragranceManager
            fragrances={fragrances}
            onCatalogueUpdated={onCatalogueUpdated}
          />
        )}

        {tab === "import" && (
          <>
            {(stage.kind === "idle" || stage.kind === "error") && (
              <UploadZone
                inputRef={fileRef}
                error={stage.kind === "error" ? stage.message : null}
                onFile={handleFile}
              />
            )}

            {stage.kind === "parsing" && (
              <Status>
                <Loader2 className="h-5 w-5 animate-spin text-gold" strokeWidth={1.6} />
                Parsing spreadsheet…
              </Status>
            )}

            {stage.kind === "preview" && (
              <PreviewTable
                rows={stage.rows}
                headers={stage.headers}
                unmappedHeaders={stage.unmappedHeaders}
                fileName={stage.fileName}
                onConfirm={handleConfirm}
                onCancel={reset}
                user={user}
              />
            )}

            {stage.kind === "uploading" && (
              <Status>
                <Loader2 className="h-5 w-5 animate-spin text-gold" strokeWidth={1.6} />
                Upserting to catalogue…
              </Status>
            )}

            {stage.kind === "done" && (
              <DoneCard
                inserted={stage.inserted}
                failed={stage.failed}
                rows={stage.rows}
                onReset={reset}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 h-10 sans text-[11px] uppercase tracking-[0.24em] transition-colors border-b-2 -mb-px ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-cream/55 hover:text-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UploadZone({
  inputRef,
  error,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  error: string | null;
  onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="mt-12">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`block border border-dashed transition-colors p-12 text-center cursor-pointer ${
          drag ? "border-gold bg-gold/5" : "border-obsidian-line bg-obsidian-soft/40 hover:border-gold/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <FileSpreadsheet className="h-10 w-10 text-gold mx-auto" strokeWidth={1.3} />
        <div className="mt-4 serif text-2xl text-cream">
          Drop a spreadsheet, or click to browse
        </div>
        <div className="mt-2 sans text-[12px] uppercase tracking-[0.22em] text-cream/45">
          .xlsx · .xls · .csv
        </div>

        {error && (
          <div className="mt-6 inline-flex items-start gap-2 px-4 py-3 border border-rust/60 bg-rust/10 text-rust sans text-[12px] text-left max-w-xl">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.6} />
            <span>{error}</span>
          </div>
        )}
      </label>
    </div>
  );
}

function PreviewTable({
  rows,
  headers,
  unmappedHeaders,
  fileName,
  onConfirm,
  onCancel,
  user,
}: {
  rows: ParsedRow[];
  headers: string[];
  unmappedHeaders: string[];
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  user: AuthUser | null;
}) {
  const valid = rows.filter((r) => r.errors.length === 0);
  const errored = rows.filter((r) => r.errors.length > 0);
  const warned = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
            Preview · {fileName}
          </div>
          <h2 className="mt-2 serif text-3xl text-cream">
            {valid.length} of {rows.length} rows ready to import
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="bg-obsidian-soft border border-obsidian-line hover:border-gold/40 text-cream px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={valid.length === 0}
            className="inline-flex items-center gap-2 bg-gold text-obsidian px-6 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft disabled:bg-obsidian-line disabled:text-cream/40 transition-colors"
          >
            <Upload className="h-4 w-4" strokeWidth={1.6} />
            {user ? `Import ${valid.length} fragrances` : "Sign in to import"}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-px bg-obsidian-line mb-4">
        <Tally label="Importable" value={valid.length} tone="ok" />
        <Tally label="With warnings" value={warned.length} tone="warn" />
        <Tally label="With errors" value={errored.length} tone="err" />
      </div>

      {unmappedHeaders.length > 0 && (
        <div className="mb-4 sans text-[12px] text-cream/50 px-1">
          Ignored columns: <span className="text-cream/70">{unmappedHeaders.join(", ")}</span>
        </div>
      )}

      <div className="overflow-x-auto border border-obsidian-line">
        <table className="w-full sans text-[13px] text-cream/80">
          <thead className="bg-obsidian-soft text-cream/55 sans text-[10px] uppercase tracking-[0.22em]">
            <tr>
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Inspiration</th>
              <th className="text-left px-3 py-2">Gender</th>
              <th className="text-right px-3 py-2">Price</th>
              <th className="text-right px-3 py-2">vs.</th>
              <th className="text-left px-3 py-2">Notes</th>
              <th className="text-left px-3 py-2">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rowNumber}
                className={`border-t border-obsidian-line ${
                  r.errors.length > 0 ? "bg-rust/5" : ""
                }`}
              >
                <td className="px-3 py-2 text-cream/40 tabular-nums">{r.rowNumber + 1}</td>
                <td className="px-3 py-2 serif text-cream text-base">
                  {r.candidate.name}
                </td>
                <td className="px-3 py-2 text-cream/65">{r.candidate.inspiration}</td>
                <td className="px-3 py-2 capitalize text-gold/85">{r.candidate.gender}</td>
                <td className="px-3 py-2 text-right text-gold tabular-nums">
                  {r.candidate.priceCents > 0
                    ? formatPrice(r.candidate.priceCents)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right text-cream/45 tabular-nums">
                  {r.candidate.comparisonPriceCents
                    ? formatPrice(r.candidate.comparisonPriceCents)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-cream/55 truncate max-w-[18rem]">
                  {r.candidate.notes.map((n) => n.name).join(", ")}
                </td>
                <td className="px-3 py-2">
                  {r.errors.length > 0 && (
                    <span className="text-rust">{r.errors.join("; ")}</span>
                  )}
                  {r.errors.length === 0 && r.warnings.length > 0 && (
                    <span className="text-gold/70">{r.warnings.join("; ")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 sans text-[11px] text-cream/45 leading-relaxed">
        Headers detected in source: {headers.filter(Boolean).join(", ") || "—"}.
      </p>
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "err";
}) {
  const tint =
    tone === "ok" ? "text-gold" : tone === "warn" ? "text-gold/70" : "text-rust";
  return (
    <div className="bg-obsidian px-5 py-4">
      <div className="sans text-[10px] uppercase tracking-[0.24em] text-cream/45">
        {label}
      </div>
      <div className={`mt-1 serif text-3xl tabular-nums ${tint}`}>{value}</div>
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-12 flex items-center gap-3 sans text-[13px] uppercase tracking-[0.24em] text-cream/70">
      {children}
    </div>
  );
}

function DoneCard({
  inserted,
  failed,
  rows,
  onReset,
}: {
  inserted: number;
  failed: number;
  rows: ParsedRow[];
  onReset: () => void;
}) {
  const valid = rows.filter((r) => r.errors.length === 0).length;
  return (
    <div className="mt-12 border border-gold/40 bg-gold/5 p-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/50 text-gold text-[10px] uppercase tracking-[0.28em] sans">
        <Check className="h-3 w-3" strokeWidth={1.8} />
        Import complete
      </div>
      <h3 className="mt-4 serif text-3xl text-cream">
        Catalogue updated locally · {valid} fragrances staged.
      </h3>
      <div className="mt-3 sans text-[14px] text-cream/65 leading-relaxed max-w-2xl">
        {isSupabaseEnabled ? (
          inserted > 0 ? (
            <>
              <span className="text-gold tabular-nums">{inserted}</span> rows
              upserted into Supabase. {failed > 0 && `${failed} skipped due to errors.`}
            </>
          ) : (
            <>
              Catalogue patched in this session, but the Supabase upsert
              returned 0 rows. Check RLS / table schema.
            </>
          )
        ) : (
          <>
            Supabase isn't configured in this build, so the import was
            applied to the in-memory catalogue only. Refreshing will revert
            it. Connect Supabase to persist.
          </>
        )}
      </div>
      <button
        onClick={onReset}
        className="mt-6 bg-gold text-obsidian px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft transition-colors"
      >
        Import another file
      </button>
    </div>
  );
}
