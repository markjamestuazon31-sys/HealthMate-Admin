export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function encodeEmailKey(value: unknown): string {
  const normalized = normalizeEmail(value);
  if (!normalized) throw new Error("Email is required.");
  const bytes = new TextEncoder().encode(normalized);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
