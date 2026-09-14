import { ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type { Responder, ResponderAvailability } from "../types";
export { listenResponders } from "./respondentInvitationService";

export async function updateResponder(id: string, data: Partial<Responder>) {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  const uid = id.trim();
  if (!uid) throw new Error("Respondent UID is required.");
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`respondents/${uid}/updatedAt`]: now,
  };
  if (data.name !== undefined) updates[`respondents/${uid}/name`] = data.name.trim();
  if (data.contact !== undefined) updates[`respondents/${uid}/contact`] = data.contact.trim();
  if (data.position !== undefined) updates[`respondents/${uid}/position`] = data.position.trim();
  if (data.address !== undefined) updates[`respondents/${uid}/address`] = data.address.trim();
  if (data.assignedBarangayId !== undefined) updates[`respondents/${uid}/assignedBarangayId`] = data.assignedBarangayId.trim();
  if (data.serviceArea !== undefined) updates[`respondents/${uid}/serviceArea`] = data.serviceArea.trim();
  if (data.accountStatus !== undefined) {
    updates[`respondents/${uid}/accountStatus`] = data.accountStatus;
    updates[`users/${uid}/accountStatus`] = data.accountStatus;
    updates[`users/${uid}/updatedAt`] = now;
  }
  await update(ref(database), updates);
}

export async function updateResponderAvailability(id: string, availability: ResponderAvailability) {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  const now = Date.now();
  await update(ref(database), {
    [`respondentPresence/${id}/availability`]: availability,
    [`respondentPresence/${id}/updatedAt`]: now,
    [`respondents/${id}/availability`]: availability,
    [`respondents/${id}/updatedAt`]: now,
  });
}
