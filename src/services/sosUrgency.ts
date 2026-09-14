import type { Emergency, EmergencyPriority } from "../types";

export function normalizeSosUrgency(value: unknown): EmergencyPriority {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "CRITICAL") return "CRITICAL";
  if (v === "MEDIUM" || v === "MODERATE") return "MEDIUM";
  if (v === "LOW") return "LOW";
  return "HIGH";
}
export function sosUrgencyLabel(value: unknown): string {
  return { CRITICAL: "Critical SOS", MEDIUM: "Moderate SOS", HIGH: "High priority SOS", LOW: "Low priority SOS" }[normalizeSosUrgency(value)];
}
export function reportedUrgencyLabel(value: unknown): string {
  if (!value) return "Not recorded";
  if (value === "UNSPECIFIED") return "Not sure • needs assessment";
  return sosUrgencyLabel(value);
}
export function sosUrgencyRank(value: unknown): number {
  return { CRITICAL: 100, HIGH: 90, MEDIUM: 50, LOW: 10 }[normalizeSosUrgency(value)];
}
export function compareSosUrgency(a: Emergency, b: Emergency): number {
  const closed = (v: Emergency) => v.status === "CLOSED" || v.status === "CANCELLED";
  return Number(closed(a)) - Number(closed(b)) || sosUrgencyRank(b.priority) - sosUrgencyRank(a.priority)
    || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}
