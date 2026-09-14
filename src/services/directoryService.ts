import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import {
  BUNUANAN_BARANGAY_ID,
  BUNUANAN_BARANGAY_NAME,
  BUNUANAN_CITY,
} from "../config/bunuananServiceArea";
import type { Barangay, EmergencyDirectoryContact } from "../types";

function requireAdmin() {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  return actor;
}

function allocateKey(path: string, message: string): string {
  const key = push(ref(database, path)).key;
  if (!key) throw new Error(message);
  return key;
}

function auditEntry(
  updates: Record<string, unknown>,
  action: string,
  actorUid: string,
  details: string,
) {
  const auditId = push(ref(database, "auditLogs")).key;
  if (!auditId) return;
  updates[`auditLogs/${auditId}`] = {
    action,
    performedBy: actorUid,
    details,
    timestamp: Date.now(),
  };
}

function normalizeBarangayToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isBunuananRecord(id: string, value: unknown): boolean {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const name = String(record.name ?? "");
  return (
    normalizeBarangayToken(id) === BUNUANAN_BARANGAY_ID ||
    normalizeBarangayToken(name) === BUNUANAN_BARANGAY_ID
  );
}

export interface BunuananDirectoryRepairResult {
  canonicalCreated: boolean;
  migratedContacts: number;
  legacySources: number;
}

/**
 * Creates the canonical Bunuanan directory and copies contacts from any older
 * Bunuanan node (for example a Firebase push-key barangay or "Bunuanan") into
 * barangays/BUNUANAN/emergencyContacts.
 *
 * Legacy nodes are intentionally NOT deleted so historical references remain safe.
 */
export async function ensureBunuananDirectory(): Promise<BunuananDirectoryRepairResult> {
  const actor = requireAdmin();
  const snapshot = await get(ref(database, "barangays"));
  const raw =
    (snapshot.val() as Record<string, Record<string, unknown>> | null) ?? {};

  const canonical =
    (raw[BUNUANAN_BARANGAY_ID] as Record<string, unknown> | undefined) ?? {};
  const canonicalContacts =
    (canonical.emergencyContacts as Record<string, unknown> | undefined) ?? {};

  const now = Date.now();
  const updates: Record<string, unknown> = {};
  const canonicalCreated = !snapshot.child(BUNUANAN_BARANGAY_ID).exists();

  if (
    canonicalCreated ||
    String(canonical.name ?? "") !== BUNUANAN_BARANGAY_NAME ||
    String(canonical.city ?? "") !== BUNUANAN_CITY ||
    canonical.active !== true
  ) {
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/name`] =
      BUNUANAN_BARANGAY_NAME;
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/city`] = BUNUANAN_CITY;
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/province`] = "Samar";
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/active`] = true;
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/createdAt`] =
      Number(canonical.createdAt) || now;
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/updatedAt`] = now;
    updates[`barangays/${BUNUANAN_BARANGAY_ID}/updatedBy`] = actor.uid;
  }

  let migratedContacts = 0;
  let legacySources = 0;

  for (const [legacyId, legacyValue] of Object.entries(raw)) {
    if (legacyId === BUNUANAN_BARANGAY_ID) continue;
    if (!isBunuananRecord(legacyId, legacyValue)) continue;

    legacySources += 1;

    const legacyContacts =
      (legacyValue?.emergencyContacts as Record<string, unknown> | undefined) ??
      {};

    for (const [contactId, contact] of Object.entries(legacyContacts)) {
      if (canonicalContacts[contactId] !== undefined) continue;

      updates[
        `barangays/${BUNUANAN_BARANGAY_ID}/emergencyContacts/${contactId}`
      ] = contact;
      migratedContacts += 1;
    }
  }

  if (Object.keys(updates).length > 0) {
    auditEntry(
      updates,
      migratedContacts > 0
        ? "Bunuanan emergency directory repaired"
        : "Bunuanan emergency directory normalized",
      actor.uid,
      `canonical=${BUNUANAN_BARANGAY_ID}; migratedContacts=${migratedContacts}; legacySources=${legacySources}`,
    );
    await update(ref(database), updates);
  }

  return {
    canonicalCreated,
    migratedContacts,
    legacySources,
  };
}

export function listenBarangays(callback: (items: Barangay[]) => void) {
  return onValue(ref(database, "barangays"), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<Barangay>> | null;
    const items: Barangay[] = raw
      ? Object.entries(raw).map(([id, value]) => ({
          id,
          name: value.name ?? "Unnamed barangay",
          city: value.city,
          province: value.province,
          active: value.active !== false,
          createdAt: value.createdAt,
          updatedAt: value.updatedAt,
        }))
      : [];
    items.sort((a, b) => a.name.localeCompare(b.name));
    callback(items);
  });
}

export async function saveBarangay(value: Partial<Barangay> & { name: string }) {
  const actor = requireAdmin();
  const name = value.name.trim();
  if (!name) throw new Error("Barangay name is required.");

  const id =
    value.id || allocateKey("barangays", "Unable to allocate a barangay ID.");
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`barangays/${id}/name`]: name,
    [`barangays/${id}/city`]: value.city?.trim() || "Catbalogan City",
    [`barangays/${id}/province`]: value.province?.trim() || "Samar",
    [`barangays/${id}/active`]: value.active !== false,
    [`barangays/${id}/createdAt`]: value.createdAt || now,
    [`barangays/${id}/updatedAt`]: now,
    [`barangays/${id}/updatedBy`]: actor.uid,
  };
  auditEntry(
    updates,
    value.id ? "Barangay updated" : "Barangay created",
    actor.uid,
    `${name} (${id})`,
  );
  await update(ref(database), updates);
  return id;
}

export async function setBarangayActive(barangay: Barangay, active: boolean) {
  const actor = requireAdmin();
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`barangays/${barangay.id}/active`]: active,
    [`barangays/${barangay.id}/updatedAt`]: now,
    [`barangays/${barangay.id}/updatedBy`]: actor.uid,
  };
  auditEntry(
    updates,
    active ? "Barangay activated" : "Barangay deactivated",
    actor.uid,
    `${barangay.name} (${barangay.id})`,
  );
  await update(ref(database), updates);
}

function contactsFromSnapshot(
  raw: Record<string, Omit<EmergencyDirectoryContact, "id">> | null,
): EmergencyDirectoryContact[] {
  const items: EmergencyDirectoryContact[] = raw
    ? Object.entries(raw).map(([id, value]) => ({ id, ...value }))
    : [];
  return items.sort((a, b) => {
    const order = (a.displayOrder ?? 999) - (b.displayOrder ?? 999);
    return order || a.shortName.localeCompare(b.shortName);
  });
}

export function listenBarangayContacts(
  barangayId: string,
  callback: (items: EmergencyDirectoryContact[]) => void,
) {
  if (!barangayId) {
    callback([]);
    return () => undefined;
  }
  return onValue(
    ref(database, `barangays/${barangayId}/emergencyContacts`),
    (snapshot) => callback(contactsFromSnapshot(snapshot.val())),
  );
}

export function listenBunuananContacts(
  callback: (items: EmergencyDirectoryContact[]) => void,
) {
  return listenBarangayContacts(BUNUANAN_BARANGAY_ID, callback);
}

export function listenGlobalContacts(
  callback: (items: EmergencyDirectoryContact[]) => void,
) {
  return onValue(ref(database, "globalEmergencyContacts"), (snapshot) => {
    callback(contactsFromSnapshot(snapshot.val()));
  });
}

export type DirectoryScope = "global" | "barangay";

function directoryBasePath(
  scope: DirectoryScope,
  barangayId?: string,
): string {
  if (scope === "global") return "globalEmergencyContacts";
  if (!barangayId) {
    throw new Error("Select a barangay before managing a local contact.");
  }
  return `barangays/${barangayId}/emergencyContacts`;
}

export async function saveDirectoryContact(
  scope: DirectoryScope,
  contact: Partial<EmergencyDirectoryContact> &
    Pick<
      EmergencyDirectoryContact,
      "shortName" | "organizationName" | "category" | "phone"
    >,
  barangayId?: string,
) {
  const actor = requireAdmin();
  const shortName = contact.shortName.trim();
  const organizationName = contact.organizationName.trim();
  const phone = contact.phone.trim();
  if (!shortName) throw new Error("Short name is required.");
  if (!organizationName) throw new Error("Organization name is required.");
  if (!phone) throw new Error("Primary phone number is required.");

  const basePath = directoryBasePath(scope, barangayId);
  const id =
    contact.id || allocateKey(basePath, "Unable to allocate a contact ID.");
  const now = Date.now();
  const record = {
    shortName,
    organizationName,
    category: contact.category,
    phone,
    alternatePhone: contact.alternatePhone?.trim() || "",
    email: contact.email?.trim().toLowerCase() || "",
    address: contact.address?.trim() || "",
    active: contact.active !== false,
    displayOrder: Number.isFinite(Number(contact.displayOrder))
      ? Number(contact.displayOrder)
      : 100,
    createdAt: contact.createdAt || now,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  const updates: Record<string, unknown> = {
    [`${basePath}/${id}`]: record,
  };
  auditEntry(
    updates,
    contact.id
      ? "Emergency directory contact updated"
      : "Emergency directory contact created",
    actor.uid,
    `${scope}:${barangayId ?? "global"}:${shortName}:${phone}`,
  );
  await update(ref(database), updates);
  return id;
}

export async function setDirectoryContactActive(
  scope: DirectoryScope,
  contact: EmergencyDirectoryContact,
  active: boolean,
  barangayId?: string,
) {
  const actor = requireAdmin();
  const basePath = directoryBasePath(scope, barangayId);
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`${basePath}/${contact.id}/active`]: active,
    [`${basePath}/${contact.id}/updatedAt`]: now,
    [`${basePath}/${contact.id}/updatedBy`]: actor.uid,
  };
  auditEntry(
    updates,
    active
      ? "Emergency directory contact activated"
      : "Emergency directory contact deactivated",
    actor.uid,
    `${scope}:${barangayId ?? "global"}:${contact.shortName}`,
  );
  await update(ref(database), updates);
}

export async function deleteDirectoryContact(
  scope: DirectoryScope,
  contact: EmergencyDirectoryContact,
  barangayId?: string,
) {
  const actor = requireAdmin();
  const basePath = directoryBasePath(scope, barangayId);
  await remove(ref(database, `${basePath}/${contact.id}`));
  const auditId = push(ref(database, "auditLogs")).key;
  if (auditId) {
    await set(ref(database, `auditLogs/${auditId}`), {
      action: "Emergency directory contact deleted",
      performedBy: actor.uid,
      details: `${scope}:${barangayId ?? "global"}:${contact.shortName}:${contact.phone}`,
      timestamp: Date.now(),
    });
  }
}
