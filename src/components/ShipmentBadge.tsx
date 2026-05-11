import { Check, CircleDashed, Package, PackageX, Truck } from "lucide-react";
import { shipmentStatusLabel } from "../lib/shipments";
import type { ShipmentStatus } from "../lib/types";

type Props = {
  status: ShipmentStatus;
  className?: string;
};

const TONE: Record<ShipmentStatus, string> = {
  pending:   "border-cream/30 text-cream/60",
  packed:    "border-gold/50 text-gold/80",
  shipped:   "border-gold text-gold",
  delivered: "border-gold/60 text-gold bg-gold/10",
  cancelled: "border-rust/50 text-rust",
};

function Icon({ status }: { status: ShipmentStatus }) {
  const cls = "h-3 w-3";
  if (status === "pending")   return <CircleDashed className={cls} strokeWidth={1.6} />;
  if (status === "packed")    return <Package className={cls} strokeWidth={1.6} />;
  if (status === "shipped")   return <Truck className={cls} strokeWidth={1.6} />;
  if (status === "delivered") return <Check className={cls} strokeWidth={1.8} />;
  return <PackageX className={cls} strokeWidth={1.6} />;
}

/**
 * Compact pill showing a shipment's current lifecycle state. Used in
 * the commits drawer, the My Orders page, and the admin manager.
 */
export default function ShipmentBadge({ status, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 h-6 border sans text-[10px] uppercase tracking-[0.22em] ${TONE[status]} ${className}`}
    >
      <Icon status={status} />
      {shipmentStatusLabel(status)}
    </span>
  );
}
