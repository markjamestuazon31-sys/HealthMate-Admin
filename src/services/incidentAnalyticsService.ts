import { onValue, ref } from "firebase/database";
import { database } from "../firebase/config";
import type { IncidentAnalyticsRecord } from "../types";
import { BUNUANAN_BARANGAY_ID, normalizeBunuananPurok } from "../config/bunuananServiceArea";
import { normalizeSosUrgency } from "./sosUrgency";

type RecordMap = Record<string, Record<string, unknown>>;
const text = (value: unknown, fallback = "") => String(value ?? "").trim() || fallback;
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const coordinate = (value: unknown) => value == null || value === "" ? NaN : Number(value);

/** One analytics record per incident ID; current urgency and state win over older projections. */
export function buildIncidentAnalytics(analytics: RecordMap, statuses: RecordMap): IncidentAnalyticsRecord[] {
  return Object.entries(analytics).flatMap(([id, value]) => {
    if (!value || typeof value !== "object") return [];
    const current = statuses[id] ?? {};
    const latitude = coordinate(value.latitude), longitude = coordinate(value.longitude);
    const barangay = text(value.barangayId).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (barangay !== BUNUANAN_BARANGAY_ID || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || latitude === 0 && longitude === 0) return [];
    return [{ id, barangayId: text(value.barangayId), purokId: normalizeBunuananPurok(value.purokId) || "Unassigned",
      purokVerificationStatus: text(value.purokVerificationStatus, "PENDING").toUpperCase(), latitude, longitude,
      type: text(current.type || value.type, "SOS Alert"),
      priority: normalizeSosUrgency(current.severity || current.priority || value.priority),
      status: text(current.status || value.status, "PENDING").toUpperCase(), createdAt: numeric(value.createdAt),
      updatedAt: numeric(current.updatedAt ?? value.updatedAt),
      resolvedAt: numeric(current.closedAt || current.cancelledAt || value.resolvedAt),
    }];
  }).sort((a,b) => b.createdAt-a.createdAt || a.id.localeCompare(b.id));
}

export function listenIncidentAnalytics(callback: (items: IncidentAnalyticsRecord[]) => void, onError?: (error: Error) => void) {
  let analytics: RecordMap = {}, statuses: RecordMap = {};
  let analyticsReady = false, statusesReady = false;
  const emit = () => { if (analyticsReady && statusesReady) callback(buildIncidentAnalytics(analytics, statuses)); };
  const stopAnalytics = onValue(ref(database, "incidentAnalytics"), snapshot => {
    analytics = snapshot.val() ?? {}; analyticsReady = true; emit();
  }, error => { analyticsReady = false; callback([]); onError?.(error); });
  const stopStatuses = onValue(ref(database, "emergencies"), snapshot => {
    statuses = snapshot.val() ?? {}; statusesReady = true; emit();
  }, error => { statusesReady = false; callback([]); onError?.(error); });
  return () => { stopAnalytics(); stopStatuses(); };
}
