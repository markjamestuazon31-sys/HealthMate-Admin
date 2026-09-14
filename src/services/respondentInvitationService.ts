import { get, onValue, push, ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import { isReservedResponderEmail } from "../policies/accountPolicy";
import type { InvitationStatus, RespondentInvitation, Responder, ResponderAvailability } from "../types";
import { encodeEmailKey, normalizeEmail } from "../utils/emailKey";

function requireAdmin() {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  return actor;
}

export function listenRespondentInvitations(callback: (items: RespondentInvitation[]) => void) {
  return onValue(ref(database, "respondentInvitations"), (snapshot) => {
    const raw = snapshot.val() as Record<string, Omit<RespondentInvitation, "id">> | null;
    const items = raw ? Object.entries(raw).map(([id, value]) => ({ id, ...value })) : [];
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    callback(items);
  });
}

export function listenResponders(callback: (items: Responder[]) => void) {
  return onValue(ref(database, "respondents"), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<Responder> & { fullName?: string; phone?: string }> | null;
    const items: Responder[] = raw ? Object.entries(raw).map(([id, value]) => ({
      id,
      authUid: value.authUid ?? id,
      role: "responder",
      accountStatus: (value.accountStatus ?? "active") as Responder["accountStatus"],
      name: value.name ?? value.fullName ?? "Unnamed respondent",
      email: normalizeEmail(value.email),
      contact: value.contact ?? value.phone ?? "",
      address: value.address,
      position: value.position,
      assignedBarangayId: value.assignedBarangayId,
      serviceArea: value.serviceArea,
      availability: (value.availability ?? "OFF_DUTY") as ResponderAvailability,
      status: value.status,
      createdBy: value.createdBy,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    })) : [];
    items.sort((a, b) => a.name.localeCompare(b.name));
    callback(items);
  });
}

export interface CreateInvitationInput {
  email: string;
  fullName: string;
  phone: string;
  position: string;
  assignedBarangayId: string;
  serviceArea?: string;
}

export async function createRespondentInvitation(input: CreateInvitationInput) {
  const actor = requireAdmin();
  const email = normalizeEmail(input.email);
  if (!isReservedResponderEmail(email)) throw new Error("Respondent invitations must use the exact @respondent.com domain.");
  if (!input.fullName.trim()) throw new Error("Full name is required.");
  if (!/^09\d{9}$/.test(input.phone.trim())) throw new Error("Phone number must use 09XXXXXXXXX.");
  if (!input.assignedBarangayId.trim()) throw new Error("Assigned barangay is required.");

  const key = encodeEmailKey(email);
  const existing = await get(ref(database, `respondentInvitations/${key}`));
  const current = existing.val() as RespondentInvitation | null;
  if (current?.registeredUid) {
    throw new Error("This email already belongs to a registered respondent. Reactivate the existing account instead of creating a new invitation.");
  }

  const now = Date.now();
  const invitation: Omit<RespondentInvitation, "id"> = {
    normalizedEmail: email,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    position: input.position.trim() || "Emergency Respondent",
    assignedBarangayId: input.assignedBarangayId.trim(),
    serviceArea: input.serviceArea?.trim() || "",
    status: "INVITED",
    createdBy: current?.createdBy || actor.uid,
    createdAt: current?.createdAt || now,
    updatedBy: actor.uid,
    updatedAt: now,
  };
  const auditId = push(ref(database, "auditLogs")).key;
  const updates: Record<string, unknown> = {
    [`respondentInvitations/${key}`]: invitation,
    [`respondentSignupEligibility/${key}`]: { eligible: true, updatedAt: now },
  };
  if (auditId) updates[`auditLogs/${auditId}`] = {
    action: "Respondent invitation created",
    performedBy: actor.uid,
    details: `${input.fullName.trim()} (${email})`,
    timestamp: now,
  };
  await update(ref(database), updates);
  return key;
}

export async function setInvitationStatus(invitation: RespondentInvitation, status: Exclude<InvitationStatus, "REGISTERED">) {
  const actor = requireAdmin();
  const now = Date.now();
  const eligible = status === "INVITED";
  const updates: Record<string, unknown> = {
    [`respondentInvitations/${invitation.id}/status`]: status,
    [`respondentInvitations/${invitation.id}/updatedBy`]: actor.uid,
    [`respondentInvitations/${invitation.id}/updatedAt`]: now,
    [`respondentSignupEligibility/${invitation.id}`]: { eligible, updatedAt: now },
  };
  if (invitation.registeredUid) {
    updates[`users/${invitation.registeredUid}/accountStatus`] = status === "SUSPENDED" ? "suspended" : "revoked";
    updates[`users/${invitation.registeredUid}/updatedAt`] = now;
    updates[`respondents/${invitation.registeredUid}/accountStatus`] = status === "SUSPENDED" ? "suspended" : "revoked";
    updates[`respondents/${invitation.registeredUid}/updatedAt`] = now;
  }
  const auditId = push(ref(database, "auditLogs")).key;
  if (auditId) updates[`auditLogs/${auditId}`] = {
    action: `Respondent invitation ${status.toLowerCase()}`,
    performedBy: actor.uid,
    userId: invitation.registeredUid || "",
    details: invitation.normalizedEmail,
    timestamp: now,
  };
  await update(ref(database), updates);
}

export async function reactivateRegisteredRespondent(invitation: RespondentInvitation) {
  const actor = requireAdmin();
  if (!invitation.registeredUid) throw new Error("This invitation has no registered respondent account.");
  const now = Date.now();
  const auditId = push(ref(database, "auditLogs")).key;
  const updates: Record<string, unknown> = {
    [`respondentInvitations/${invitation.id}/status`]: "REGISTERED",
    [`respondentInvitations/${invitation.id}/updatedBy`]: actor.uid,
    [`respondentInvitations/${invitation.id}/updatedAt`]: now,
    [`respondentSignupEligibility/${invitation.id}`]: { eligible: false, updatedAt: now },
    [`users/${invitation.registeredUid}/accountStatus`]: "active",
    [`users/${invitation.registeredUid}/updatedAt`]: now,
    [`respondents/${invitation.registeredUid}/accountStatus`]: "active",
    [`respondents/${invitation.registeredUid}/updatedAt`]: now,
  };
  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "Registered respondent reactivated",
      performedBy: actor.uid,
      userId: invitation.registeredUid,
      details: invitation.normalizedEmail,
      timestamp: now,
    };
  }
  await update(ref(database), updates);
}
