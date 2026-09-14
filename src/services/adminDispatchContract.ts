import type { AdminRole } from "../types";

export interface AdminDispatchIdentity {
  uid: string;
  email: string;
  fullName?: string;
  role: AdminRole;
}

export interface AdminDispatchRecord {
  active: true;
  online: boolean;
  role: AdminRole;
  fullName: string;
  email: string;
  updatedAt: number | object;
}

export function buildAdminDispatchRecord(
  identity: AdminDispatchIdentity,
  now: number | object = Date.now(),
): AdminDispatchRecord {
  return {
    active: true,
    online: true,
    role: identity.role,
    fullName: identity.fullName?.trim() || identity.email.split("@")[0] || "Administrator",
    email: identity.email.trim().toLowerCase(),
    updatedAt: now,
  };
}
