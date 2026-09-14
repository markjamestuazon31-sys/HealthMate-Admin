import type { AdminRole } from "../types";

export const RESPONDER_EMAIL_DOMAIN = "respondent.com";
const ADMIN_ROLES = new Set<AdminRole>(["administrator", "admin"]);

export interface PortalAccountProfile {
  role?: unknown;
  status?: unknown;
  accountStatus?: unknown;
  email?: unknown;
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isReservedResponderEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  const separator = email.lastIndexOf("@");
  return separator > 0 && email.slice(separator + 1) === RESPONDER_EMAIL_DOMAIN;
}

export function normalizeAdminRole(value: unknown): AdminRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase() as AdminRole;
  return ADMIN_ROLES.has(role) ? role : null;
}

export function resolveAdminRole(
  profile: PortalAccountProfile | null | undefined,
  authenticatedEmail: unknown,
): AdminRole | null {
  if (!profile) return null;
  const role = normalizeAdminRole(profile.role);
  if (!role) return null;
  const status = String(profile.accountStatus ?? profile.status ?? "").trim().toLowerCase();
  if (status !== "active") return null;
  const authEmail = normalizeEmail(authenticatedEmail);
  if (!authEmail) return null;

  // The caller reads /admins/{authenticated UID}; that UID binding is the
  // authorization identity. A missing or stale duplicated email field must
  // not reject otherwise valid Firebase Authentication credentials.
  return role;
}
