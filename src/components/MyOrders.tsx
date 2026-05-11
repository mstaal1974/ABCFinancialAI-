import { ArrowLeft, ExternalLink, Loader2, Lock, PackageSearch, RefreshCw } from "lucide-react";
import type { AuthUser } from "../lib/auth";
import { shipmentSourceLabel, useUserShipments } from "../lib/shipments";
import type { Shipment } from "../lib/types";
import ShipmentBadge from "./ShipmentBadge";

type Props = {
  user: AuthUser | null;
  onBack: () => void;
  onRequireAuth: (reason?: string) => void;
};

export default function MyOrders({ user, onBack, onRequireAuth }: Props) {
  const { shipments, loading, refresh } = useUserShipments(user?.email ?? null);

  if (!user) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-32 text-center">
        <div className="sans text-[10px] uppercase tracking-[0.32em] text-gold/80">
          My Orders
        </div>
        <h2 className="mt-3 serif text-4xl text-cream">Sign in to see your shipments</h2>
        <p className="mt-4 sans text-[14px] text-cream/65 leading-relaxed">
          Tracking is tied to your account. Sign in and we'll show every
          batch commit, sample box, and subscription pick on its way to you.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="bg-obsidian-soft border border-obsidian-line hover:border-gold/40 text-cream px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => onRequireAuth("Sign in to view your orders.")}
            className="inline-flex items-center gap-2 bg-gold text-obsidian px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft transition-colors"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />
            Sign in
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative">
      <div className="mx-auto max-w-5xl px-6 lg:px-10 py-12 lg:py-16">
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
              My Orders · {shipments.length}
            </div>
            <h1 className="mt-3 serif text-4xl lg:text-5xl text-cream">
              Every bottle on its way to you.
            </h1>
            <p className="mt-3 sans text-[14px] text-cream/60 max-w-2xl leading-relaxed">
              Track each commit, sample box, and subscription pick from the
              studio bench to your door. Status updates as our dispatch team
              moves the parcel through pack and ship.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-obsidian-line hover:border-gold/40 text-cream/80 hover:text-gold px-3 h-10 sans text-[11px] uppercase tracking-[0.24em] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
            Refresh
          </button>
        </div>

        {shipments.length === 0 && !loading && (
          <div className="mt-10 border border-obsidian-line bg-obsidian-soft/40 p-12 text-center">
            <PackageSearch className="h-8 w-8 text-gold mx-auto" strokeWidth={1.3} />
            <h3 className="mt-4 serif text-2xl text-cream">No shipments yet</h3>
            <p className="mt-2 sans text-[13px] text-cream/55 leading-relaxed max-w-md mx-auto">
              Reserve a fragrance, order a sample box, or pick a subscription
              month — every order will surface here with live tracking.
            </p>
            <button
              onClick={onBack}
              className="mt-6 inline-flex items-center gap-2 bg-gold text-obsidian px-5 h-11 sans text-[11px] uppercase tracking-[0.26em] hover:bg-gold-soft transition-colors"
            >
              Open the Vault
            </button>
          </div>
        )}

        <ul className="mt-8 space-y-3">
          {shipments.map((s) => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const events: Array<{ label: string; ts: string | null }> = [
    { label: "Order placed", ts: shipment.createdAt },
    { label: "Packed",       ts: shipment.packedAt },
    { label: "Shipped",      ts: shipment.shippedAt },
    { label: "Delivered",    ts: shipment.deliveredAt },
  ];

  return (
    <li className="border border-obsidian-line bg-obsidian-soft/40 p-5 hover:border-gold/30 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <ShipmentBadge status={shipment.status} />
            <span className="sans text-[10px] uppercase tracking-[0.24em] text-cream/55">
              {shipmentSourceLabel(shipment.sourceType)}
            </span>
          </div>
          <div className="mt-2 serif text-lg text-cream">
            {shipment.recipientName ?? "Your shipment"}
          </div>
          {shipment.recipientAddress && (
            <div className="sans text-[12px] text-cream/55 mt-0.5">
              {shipment.recipientAddress}
            </div>
          )}
        </div>
        {shipment.trackingNumber && (
          <div className="text-right">
            <div className="sans text-[10px] uppercase tracking-[0.22em] text-cream/45">
              {shipment.carrier ?? "Carrier"}
            </div>
            <div className="mt-1 font-mono text-[12px] text-cream tabular-nums">
              {shipment.trackingNumber}
            </div>
            {shipment.trackingUrl && (
              <a
                href={shipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 sans text-[10px] uppercase tracking-[0.22em] text-gold hover:text-gold-soft"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={1.6} />
                Track
              </a>
            )}
          </div>
        )}
      </div>

      <ol className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px bg-obsidian-line">
        {events.map((e) => (
          <li key={e.label} className="bg-obsidian px-3 py-2.5">
            <div className="sans text-[10px] uppercase tracking-[0.22em] text-cream/40">
              {e.label}
            </div>
            <div
              className={`mt-0.5 sans text-[12px] tabular-nums ${
                e.ts ? "text-gold" : "text-cream/30"
              }`}
            >
              {e.ts ? new Date(e.ts).toLocaleDateString() : "—"}
            </div>
          </li>
        ))}
      </ol>

      {shipment.notes && (
        <p className="mt-4 sans text-[12px] text-cream/55 italic">
          “{shipment.notes}”
        </p>
      )}
    </li>
  );
}
