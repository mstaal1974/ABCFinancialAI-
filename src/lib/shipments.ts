import { useCallback, useEffect, useState } from "react";
import { isSupabaseEnabled, supabase } from "./supabase";
import type { Shipment, ShipmentSourceType, ShipmentStatus } from "./types";

const LOCAL_KEY = "mo:shipments:v1";

type ShipmentRow = {
  id: string;
  source_type: ShipmentSourceType;
  source_id: string;
  user_id: string | null;
  user_email: string | null;
  status: ShipmentStatus;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  notes: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    userId: row.user_id,
    userEmail: row.user_email,
    status: row.status,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    recipientName: row.recipient_name,
    recipientAddress: row.recipient_address,
    notes: row.notes,
    packedAt: row.packed_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readLocal(): Shipment[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Shipment[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(value: Shipment[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "pending",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

export type CreateShipmentInput = {
  sourceType: ShipmentSourceType;
  sourceId: string;
  userId: string | null;
  userEmail: string | null;
  recipientName?: string | null;
};

/**
 * Auto-create a shipment row when an order is placed. Called from the
 * commit / sample box / subscription-pick flows. Idempotent on
 * (source_type, source_id) — the DB enforces a unique constraint, and
 * if Supabase is unreachable we fall back to localStorage with the
 * same de-duplication semantics.
 */
export async function createShipment(input: CreateShipmentInput): Promise<Shipment> {
  const now = new Date().toISOString();
  const shipment: Shipment = {
    id: crypto.randomUUID(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    userId: input.userId && !input.userId.startsWith("demo-") ? input.userId : null,
    userEmail: input.userEmail,
    status: "pending",
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    recipientName: input.recipientName ?? null,
    recipientAddress: null,
    notes: null,
    packedAt: null,
    shippedAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseEnabled && supabase) {
    try {
      const { data, error } = await supabase
        .from("shipments")
        .insert({
          id: shipment.id,
          source_type: shipment.sourceType,
          source_id: shipment.sourceId,
          user_id: shipment.userId,
          user_email: shipment.userEmail,
          status: shipment.status,
          recipient_name: shipment.recipientName,
        })
        .select("*")
        .maybeSingle<ShipmentRow>();
      if (!error && data) return rowToShipment(data);
    } catch {
      /* offline — fall through to local */
    }
  }

  // Local fallback (also handles offline mode).
  const local = readLocal();
  const existing = local.find(
    (s) => s.sourceType === shipment.sourceType && s.sourceId === shipment.sourceId,
  );
  if (existing) return existing;
  writeLocal([shipment, ...local]);
  return shipment;
}

export type UpdateShipmentInput = {
  id: string;
  status?: ShipmentStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  notes?: string | null;
  recipientAddress?: string | null;
};

/**
 * Admin update: set status / carrier / tracking. Auto-stamps the
 * relevant timestamp when a status crosses into packed / shipped /
 * delivered for the first time.
 */
export async function updateShipment(input: UpdateShipmentInput): Promise<Shipment | null> {
  const patch: Partial<ShipmentRow> = {};
  const now = new Date().toISOString();
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "packed") patch.packed_at = now;
    if (input.status === "shipped") patch.shipped_at = now;
    if (input.status === "delivered") patch.delivered_at = now;
  }
  if (input.carrier !== undefined) patch.carrier = input.carrier;
  if (input.trackingNumber !== undefined) patch.tracking_number = input.trackingNumber;
  if (input.trackingUrl !== undefined) patch.tracking_url = input.trackingUrl;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.recipientAddress !== undefined) patch.recipient_address = input.recipientAddress;

  if (isSupabaseEnabled && supabase) {
    const { data, error } = await supabase
      .from("shipments")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .maybeSingle<ShipmentRow>();
    if (error) throw new Error(error.message);
    return data ? rowToShipment(data) : null;
  }

  // Local fallback.
  const local = readLocal();
  const next = local.map((s) => {
    if (s.id !== input.id) return s;
    const updated: Shipment = {
      ...s,
      ...(input.status !== undefined && { status: input.status }),
      ...(input.carrier !== undefined && { carrier: input.carrier }),
      ...(input.trackingNumber !== undefined && { trackingNumber: input.trackingNumber }),
      ...(input.trackingUrl !== undefined && { trackingUrl: input.trackingUrl }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.recipientAddress !== undefined && { recipientAddress: input.recipientAddress }),
      updatedAt: now,
    };
    if (input.status === "packed" && !s.packedAt) updated.packedAt = now;
    if (input.status === "shipped" && !s.shippedAt) updated.shippedAt = now;
    if (input.status === "delivered" && !s.deliveredAt) updated.deliveredAt = now;
    return updated;
  });
  writeLocal(next);
  return next.find((s) => s.id === input.id) ?? null;
}

/**
 * Hook: member-side shipment list. Pulls everything visible to the
 * current user (their own rows via RLS) and refreshes on demand. In
 * demo mode (no Supabase) reads from localStorage.
 */
export function useUserShipments(currentUserEmail: string | null) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentUserEmail) {
      setShipments([]);
      return;
    }
    if (isSupabaseEnabled && supabase) {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("shipments")
          .select("*")
          .eq("user_email", currentUserEmail)
          .order("created_at", { ascending: false });
        if (!error && data) {
          setShipments((data as ShipmentRow[]).map(rowToShipment));
        }
      } finally {
        setLoading(false);
      }
    } else {
      const local = readLocal().filter((s) => s.userEmail === currentUserEmail);
      setShipments(local);
    }
  }, [currentUserEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  return { shipments, loading, refresh: load };
}

/**
 * Hook: admin-side shipment list. Fetches every shipment. Caller is
 * responsible for gating access (e.g. AdminGate by allowlisted email).
 */
export function useAdminShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (isSupabaseEnabled && supabase) {
      setLoading(true);
      try {
        const { data, error: err } = await supabase
          .from("shipments")
          .select("*")
          .order("updated_at", { ascending: false });
        if (err) {
          setError(err.message);
        } else if (data) {
          setShipments((data as ShipmentRow[]).map(rowToShipment));
        }
      } finally {
        setLoading(false);
      }
    } else {
      setShipments(readLocal());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyLocal = useCallback((next: Shipment) => {
    setShipments((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  }, []);

  return { shipments, loading, error, refresh: load, applyLocal };
}

/** Pretty label for status badges. */
export function shipmentStatusLabel(status: ShipmentStatus): string {
  switch (status) {
    case "pending":   return "Pending";
    case "packed":    return "Packed";
    case "shipped":   return "Shipped";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
  }
}

export function shipmentSourceLabel(source: ShipmentSourceType): string {
  switch (source) {
    case "commit":            return "Batch commit";
    case "sample_box":        return "Sample box";
    case "subscription_pick": return "Subscription pick";
  }
}
