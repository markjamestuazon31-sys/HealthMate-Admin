export const BUNUANAN_BARANGAY_ID = "BUNUANAN";
export const BUNUANAN_BARANGAY_NAME = "Bunuanan";
export const BUNUANAN_CITY = "Catbalogan City";

/** Canonical Purok values used by registration, profiling, incidents, and heatmap filters. */
export const BUNUANAN_PUROKS = [
  "Purok 1",
  "Purok 2",
  "Purok 3",
  "Purok 4",
  "Purok 5",
] as const;

export type BunuananPurok = (typeof BUNUANAN_PUROKS)[number];

export function normalizeBunuananPurok(value: unknown): BunuananPurok | "" {
  let compact = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("PUROK")) compact = compact.slice(5);
  if (/^[1-5]$/.test(compact)) return `Purok ${compact}` as BunuananPurok;
  return "";
}

export function isBunuananPurok(value: unknown): value is BunuananPurok {
  return Boolean(normalizeBunuananPurok(value));
}

export function purokSortValue(value: unknown): number {
  const normalized = normalizeBunuananPurok(value);
  return normalized ? Number(normalized.slice(-1)) : Number.MAX_SAFE_INTEGER;
}
