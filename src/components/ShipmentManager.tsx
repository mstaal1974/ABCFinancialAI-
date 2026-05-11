import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SHIPMENT_STATUSES,
  shipmentSourceLabel,
  updateShipment,
  useAdminShipments,
} from "../lib/shipments";
import { isSupabaseEnabled } from "../lib/supabase";
import type { Shipment, ShipmentStatus } from "../lib/types";
import ShipmentBadge from "./ShipmentBadge";

type Draft = {
  status: ShipmentStatus;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  recipientAddress: string;
  notes: string;
};

function shipmentToDraft(s: Shipment): Draft {
  return {
    status: s.status,
    carrier: s.carrier ?? "",
    trackingNumber: s.trackingNumber ?? "",
    trackingUrl: s.trackingUrl ?? "",
    recipientAddress: s.recipientAddress ?? "",
    notes: s.notes ?? "",
  };
}

export default function ShipmentManager() {
  const { shipments, loading, error, refresh, applyLocal } = useAdminShipments();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "all">("all");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shipments.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.userEmail ?? "").toLowerCase().includes(q) ||
        (s.recipientName ?? "").toLowerCase().includes(q) ||
        (s.trackingNumber ?? "").toLowerCase().includes(q) ||
        s.sourceId.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [shipments, query, statusFilter]);

  function draftFor(s: Shipment): Draft {
    return drafts[s.id] ?? shipmentToDraft(s);
  }

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? shipmentToDraft(shipments.find((s) => s.id === id)!)), ...patch },
    }));
  }

  async function handleSave(s: Shipment) {
    const d = draftFor(s);
    setSavingId(s.id);
    setSaveError(null);
    try {
      const next = await updateShipment({
        id: s.id,
        status: d.status,
        carrier: d.carrier.trim() || null,
        trackingNumber: d.trackingNumber.trim() || null,
        trackingUrl: d.trackingUrl.trim() || null,
        recipientAddress: d.recipientAddress.trim() || null,
        notes: d.notes.trim() || null,
      });
      if (next) {
        applyLocal(next);
        setDrafts((prev) => {
          const copy = { ...prev };
          delete copy[s.id];
          return copy;
        });
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save shipment.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="sans text-[10px] uppercase tracking-[0.28em] text-gold/80">
            Dispatch · {shipments.length} shipments
          </div>
          <h2 className="mt-2 serif text-3xl text-cream">
            Pack, dispatch, and track the studio's shipments.
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
              placeholder="Search email, name, tracking #"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 bg-obsidian border border-obsidian-line focus:border-gold/60 focus:outline-none text-cream sans text-[13px] pl-9 pr-3 h-11 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | "all")}
            className="bg-obsidian border border-obsidian-line text-cream sans text-[12px] uppercase tracking-[0.22em] px-3 h-11 transition-colors"
          >
            <option value="all">All statuses</option>
            {SHIPMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-obsidian-line hover:border-gold/40 text-cream/80 hover:text-gold px-3 h-11 sans text-[11px] uppercase tracking-[0.24em] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {!isSupabaseEnabled && (
        <div className="mt-6 sans text-[12px] text-cream/55 px-1">
          Supabase isn't configured — shipments are kept in-memory only.
        </div>
      )}

      {error && (
        <div className="mt-6 inline-flex items-start gap-2 px-4 py-3 border border-rust/60 bg-rust/10 text-rust sans text-[12px]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span>{error}</span>
        </div>
      )}

      {saveError && (
        <div className="mt-4 inline-flex items-start gap-2 px-4 py-3 border border-rust/60 bg-rust/10 text-rust sans text-[12px]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span>{saveError}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <div className="border border-obsidian-line bg-obsidian-soft/40 p-10 text-center sans text-[12px] uppercase tracking-[0.22em] text-cream/45">
            {shipments.length === 0
              ? "No shipments yet — they'll appear once members place orders."
              : "No shipments match the current filters."}
          </div>
        )}

        {filtered.map((s) => {
          const d = draftFor(s);
          const dirty =
            d.status !== s.status ||
            d.carrier !== (s.carrier ?? "") ||
            d.trackingNumber !== (s.trackingNumber ?? "") ||
            d.trackingUrl !== (s.trackingUrl ?? "") ||
            d.recipientAddress !== (s.recipientAddress ?? "") ||
            d.notes !== (s.notes ?? "");

          return (
            <div
              key={s.id}
              className="border border-obsidian-line bg-obsidian-soft/40 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <ShipmentBadge status={s.status} />
                    <span className="sans text-[10px] uppercase tracking-[0.24em] text-cream/55">
                      {shipmentSourceLabel(s.sourceType)}
                    </span>
                    <span className="sans text-[10px] uppercase tracking-[0.22em] text-cream/35 font-mono">
                      {s.sourceId.slice(0, 8)}…
                    </span>
                  </div>
                  <div className="mt-2 serif text-lg text-cream">
                    {s.recipientName ?? s.userEmail ?? "Member"}
                  </div>
                  {s.userEmail && (
                    <div className="sans text-[11px] text-cream/55">
                      {s.userEmail}
                    </div>
                  )}
                </div>
                <div className="text-right sans text-[10px] uppercase tracking-[0.22em] text-cream/45 tabular-nums">
                  <div>Created {new Date(s.createdAt).toLocaleDateString()}</div>
                  {s.shippedAt && (
                    <div className="text-gold/80">
                      Shipped {new Date(s.shippedAt).toLocaleDateString()}
                    </div>
                  )}
                  {s.deliveredAt && (
                    <div className="text-gold">
                      Delivered {new Date(s.deliveredAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid md:grid-cols-3 gap-3">
                <AdminField label="Status">
                  <select
                    value={d.status}
                    onChange={(e) => patchDraft(s.id, { status: e.target.value as ShipmentStatus })}
                    className={adminInputClass}
                  >
                    {SHIPMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Carrier">
                  <input
                    type="text"
                    value={d.carrier}
                    onChange={(e) => patchDraft(s.id, { carrier: e.target.value })}
                    placeholder="DHL · UPS · FedEx…"
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label="Tracking #">
                  <input
                    type="text"
                    value={d.trackingNumber}
                    onChange={(e) => patchDraft(s.id, { trackingNumber: e.target.value })}
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label="Tracking URL" full>
                  <input
                    type="url"
                    value={d.trackingUrl}
                    onChange={(e) => patchDraft(s.id, { trackingUrl: e.target.value })}
                    placeholder="https://…"
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label="Recipient address" full>
                  <input
                    type="text"
                    value={d.recipientAddress}
                    onChange={(e) => patchDraft(s.id, { recipientAddress: e.target.value })}
                    className={adminInputClass}
                  />
                </AdminField>
                <AdminField label="Notes" full>
                  <textarea
                    value={d.notes}
                    onChange={(e) => patchDraft(s.id, { notes: e.target.value })}
                    rows={2}
                    className={`${adminInputClass} h-auto py-2 resize-y`}
                  />
                </AdminField>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                {s.trackingUrl ? (
                  <a
                    href={s.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 sans text-[11px] uppercase tracking-[0.22em] text-gold hover:text-gold-soft"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                    Open tracking
                  </a>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => handleSave(s)}
                  disabled={!dirty || savingId === s.id}
                  className="inline-flex items-center gap-2 bg-gold text-obsidian px-5 h-10 sans text-[11px] uppercase tracking-[0.24em] hover:bg-gold-soft disabled:bg-obsidian-line disabled:text-cream/40 transition-colors"
                >
                  {savingId === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
                  ) : (
                    <Save className="h-4 w-4" strokeWidth={1.6} />
                  )}
                  Save changes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const adminInputClass =
  "w-full bg-obsidian border border-obsidian-line focus:border-gold/60 focus:outline-none text-cream sans text-[13px] px-3 h-10 transition-colors";

function AdminField({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "md:col-span-3" : ""}`}>
      <span className="sans text-[10px] uppercase tracking-[0.24em] text-cream/55">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
