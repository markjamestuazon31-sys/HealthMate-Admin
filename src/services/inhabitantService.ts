import { get, onValue, push, ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type { Household } from "../types";
import { REGISTRY_LOCATION, SOCIAL_FIELDS, todayInManila, validDate, type RegistryInhabitant } from "./inhabitantModel";
import { BUNUANAN_BARANGAY_ID, BUNUANAN_BARANGAY_NAME, BUNUANAN_CITY, normalizeBunuananPurok } from "../config/bunuananServiceArea";
export { BUNUANAN_BARANGAY_ID, BUNUANAN_BARANGAY_NAME, BUNUANAN_CITY } from "../config/bunuananServiceArea";

export const PH_PHONE_PATTERN = /^09\d{9}$/;
const clean = (v: unknown) => String(v ?? "").trim();
type Updates = Record<string, unknown>;
function actorUid() {
  if (!auth.currentUser) throw new Error("Your administrator session has expired. Sign in again.");
  return auth.currentUser.uid;
}
function recordId(path: string, id?: string) {
  const key = clean(id) || push(ref(database, path)).key;
  if (!key || /[.#$\[\]/]/.test(key)) throw new Error("Invalid record identifier.");
  return key;
}
function phone(value: unknown, label: string) {
  if (clean(value) && !PH_PHONE_PATTERN.test(clean(value))) throw new Error(`${label} must use 09XXXXXXXXX, or be left blank.`);
}
function nonnegative(value: unknown, label: string) {
  if (value !== null && value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new Error(`${label} must be a non-negative number, or be left blank.`);
  }
}
function fields(updates: Updates, path: string, value: object) {
  Object.entries(value).forEach(([key, item]) => { if (item !== undefined) updates[`${path}/${key}`] = item; });
}
function audit(updates: Updates, action: string, uid: string, details: object) {
  updates[`auditLogs/${recordId("auditLogs")}`] = { action, performedBy: uid, timestamp: Date.now(), ...details };
}
function checkRevision(old: { updatedAt?: number } | null, expected?: number) {
  if (expected !== undefined && Number(old?.updatedAt || 0) !== expected) {
    throw new Error("This record changed while you were editing. Close the form and reopen it to use the latest information.");
  }
}

export function listenHouseholds(callback: (items: Household[]) => void, onError?: (error: Error) => void) {
  return onValue(ref(database, "households"), snapshot => {
    const raw = (snapshot.val() || {}) as Record<string, Household>;
    callback(Object.entries(raw).filter(([, v]) => v && typeof v === "object").map(([id, value]) => ({
      ...value, id, householdName: clean(value.householdName) || "Unnamed household",
      purokId: normalizeBunuananPurok(value.purokId) || clean(value.purokId),
    })).sort((a, b) => a.householdName.localeCompare(b.householdName)));
  }, onError);
}
export function listenInhabitants(callback: (items: RegistryInhabitant[]) => void, onError?: (error: Error) => void) {
  return onValue(ref(database, "inhabitants"), snapshot => {
    const raw = (snapshot.val() || {}) as Record<string, RegistryInhabitant>;
    callback(Object.entries(raw).filter(([, v]) => v && typeof v === "object").map(([id, value]) => ({
      ...value, id, fullName: clean(value.fullName) || "Unnamed inhabitant", householdId: clean(value.householdId),
    })).sort((a, b) => a.fullName.localeCompare(b.fullName)));
  }, onError);
}

export interface HouseholdInput {
  id?: string; expectedUpdatedAt?: number; householdName: string; purokId: string; address: string;
  landmark?: string; householdType?: string; tenureStatus?: string; unitNumber?: string;
  primaryContact: string; secondaryContact?: string; monthlyIncome?: number | null; status?: Household["status"];
}
export type InhabitantInput = Omit<RegistryInhabitant, "id" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt" | "linkedUserUid"> & {
  id?: string; expectedUpdatedAt?: number;
};
export type HouseholdMemberRegistrationInput = Omit<InhabitantInput, "id" | "householdId">;

export function validateHouseholdInput(input: HouseholdInput) {
  if (!clean(input.householdName)) throw new Error("Enter a household name.");
  if (!normalizeBunuananPurok(input.purokId)) throw new Error("Select the household's Purok (1–5).");
  if (!clean(input.address)) throw new Error("Enter the household address.");
  if (input.status && !["active", "inactive", "relocated"].includes(input.status)) throw new Error("Choose a valid household status.");
  phone(input.primaryContact, "Primary contact"); phone(input.secondaryContact, "Secondary contact");
  nonnegative(input.monthlyIncome, "Household income");
}
export function validateInhabitantInput(input: HouseholdMemberRegistrationInput) {
  if (!clean(input.fullName)) throw new Error("Enter the inhabitant's full name.");
  if (!clean(input.relationshipToHead)) throw new Error("Enter the relationship to the head, or 'Not assigned'.");
  if (input.birthDate && (!validDate(input.birthDate) || input.birthDate > todayInManila())) throw new Error("Enter a valid birthday that is not in the future.");
  if (!["active", "relocated", "deceased"].includes(input.status)) throw new Error("Choose a valid inhabitant status.");
  if (input.isHouseholdHead && input.status !== "active") throw new Error("Only an active inhabitant can be the household head. Uncheck 'Household head' first.");
  if (input.familyNumber != null && (!Number.isInteger(input.familyNumber) || input.familyNumber < 1)) throw new Error("Family number must be a whole number starting at 1, or blank.");
  SOCIAL_FIELDS.forEach(([key]) => { if (input[key] != null && typeof input[key] !== "boolean") throw new Error("Choose Yes, No, or Not recorded for social data."); });
  phone(input.phone, "Mobile number"); nonnegative(input.monthlyIncome, "Personal income");
}
function householdFields(input: HouseholdInput, uid: string, now: number) {
  return {
    householdName: clean(input.householdName), purokId: normalizeBunuananPurok(input.purokId), address: clean(input.address),
    barangayId: BUNUANAN_BARANGAY_ID, barangayName: BUNUANAN_BARANGAY_NAME, city: BUNUANAN_CITY,
    region: REGISTRY_LOCATION.region, province: REGISTRY_LOCATION.province,
    landmark: clean(input.landmark), householdType: clean(input.householdType), tenureStatus: clean(input.tenureStatus),
    unitNumber: clean(input.unitNumber), primaryContact: clean(input.primaryContact), secondaryContact: clean(input.secondaryContact),
    monthlyIncome: input.monthlyIncome ?? null, status: input.status ?? "active", updatedBy: uid, updatedAt: now,
  };
}
function inhabitantFields(input: InhabitantInput, uid: string, now: number) {
  const result: Updates = {
    householdId: clean(input.householdId), fullName: clean(input.fullName), birthDate: clean(input.birthDate),
    sex: clean(input.sex), civilStatus: clean(input.civilStatus), relationshipToHead: input.isHouseholdHead ? "Head" : clean(input.relationshipToHead),
    phone: clean(input.phone), isHouseholdHead: Boolean(input.isHouseholdHead), status: input.status,
    address: clean(input.address), purokId: normalizeBunuananPurok(input.purokId), familyNumber: input.familyNumber ?? null,
    occupation: clean(input.occupation), employmentStatus: clean(input.employmentStatus), schoolAttendance: clean(input.schoolAttendance),
    citizenship: clean(input.citizenship), nationality: clean(input.nationality), monthlyIncome: input.monthlyIncome ?? null,
    profileNotes: clean(input.profileNotes), updatedBy: uid, updatedAt: now,
  };
  SOCIAL_FIELDS.forEach(([key]) => { result[key] = input[key] ?? null; });
  // Retain existing medical notes when callers do not edit them.
  for (const key of ["medicalConditions", "medicalHistory", "pastTreatments", "emergencyNotes"] as const) {
    if (input[key] !== undefined) result[key] = clean(input[key]);
  }
  return result;
}

export async function saveHousehold(input: HouseholdInput): Promise<string> {
  const uid = actorUid(); validateHouseholdInput(input);
  const id = recordId("households", input.id), now = Date.now();
  const old = input.id ? (await get(ref(database, `households/${id}`))).val() as Household | null : null;
  if (input.id && !old) throw new Error("This household no longer exists.");
  checkRevision(old, input.expectedUpdatedAt);
  const updates: Updates = {};
  fields(updates, `households/${id}`, householdFields(input, uid, now));
  if (!old) fields(updates, `households/${id}`, { createdAt: now, createdBy: uid, qrCode: `HEALTHMATE:HOUSEHOLD:${id}` });
  audit(updates, old ? "HOUSEHOLD_UPDATED" : "HOUSEHOLD_CREATED", uid, { householdId: id, details: clean(input.householdName) });
  await update(ref(database), updates);
  return id;
}

/** One atomic write creates the household and all initial members. No mobile-account paths are read or written. */
export async function registerHouseholdWithMembers(input: HouseholdInput, members: HouseholdMemberRegistrationInput[]): Promise<string> {
  const uid = actorUid(); validateHouseholdInput(input);
  if (input.id) throw new Error("Use Edit household for an existing record.");
  if (!members.length || members.filter(m => m.isHouseholdHead).length !== 1) throw new Error("Register exactly one household head.");
  members.forEach(validateInhabitantInput);
  const id = recordId("households"), now = Date.now(), updates: Updates = {};
  const household: Updates = { ...householdFields(input, uid, now), createdBy: uid, createdAt: now, qrCode: `HEALTHMATE:HOUSEHOLD:${id}` };
  members.forEach(member => {
    const memberId = recordId("inhabitants");
    updates[`inhabitants/${memberId}`] = { ...inhabitantFields({ ...member, householdId: id }, uid, now), createdBy: uid, createdAt: now };
    updates[`householdMembers/${id}/${memberId}`] = true;
    if (member.isHouseholdHead) { household.householdHeadId = memberId; household.householdHeadName = clean(member.fullName); }
  });
  updates[`households/${id}`] = household;
  audit(updates, "HOUSEHOLD_REGISTERED", uid, { householdId: id, details: `${clean(input.householdName)}; ${members.length} member(s)` });
  await update(ref(database), updates); return id;
}

export async function saveInhabitant(input: InhabitantInput): Promise<string> {
  const uid = actorUid(); validateInhabitantInput(input);
  const householdId = clean(input.householdId);
  if (householdId) recordId("households", householdId);
  if (!householdId && (!clean(input.address) || !normalizeBunuananPurok(input.purokId))) throw new Error("Record an address and Purok, or select a household.");
  if (!householdId && (input.isHouseholdHead || input.familyNumber != null)) throw new Error("Assign a household before setting its head or family number.");
  const id = recordId("inhabitants", input.id), now = Date.now();
  const [oldSnap, householdSnap] = await Promise.all([
    input.id ? get(ref(database, `inhabitants/${id}`)) : Promise.resolve(null),
    householdId ? get(ref(database, `households/${householdId}`)) : Promise.resolve(null),
  ]);
  const old = oldSnap?.val() as RegistryInhabitant | null;
  const household = householdSnap?.val() as Household | null;
  if (input.id && !old) throw new Error("This inhabitant no longer exists.");
  if (householdId && !household) throw new Error("The selected household no longer exists.");
  if (household && household.status !== "active" && input.status === "active") throw new Error("Reactivate this household first, or choose an active household.");
  checkRevision(old, input.expectedUpdatedAt);
  const updates: Updates = {};
  fields(updates, `inhabitants/${id}`, inhabitantFields(input, uid, now));
  if (!old) fields(updates, `inhabitants/${id}`, { createdAt: now, createdBy: uid });
  if (old?.householdId && old.householdId !== householdId) {
    updates[`householdMembers/${old.householdId}/${id}`] = null;
    const oldHousehold = (await get(ref(database, `households/${old.householdId}`))).val() as Household | null;
    if (oldHousehold) {
      fields(updates, `households/${old.householdId}`, { updatedBy: uid, updatedAt: now });
      if (oldHousehold.householdHeadId === id) fields(updates, `households/${old.householdId}`, { householdHeadId: null, householdHeadName: null });
    }
  }
  if (household) {
    updates[`householdMembers/${householdId}/${id}`] = true;
    fields(updates, `households/${householdId}`, { updatedBy: uid, updatedAt: now });
    if (input.isHouseholdHead) {
      const previousHeadId = clean(household.householdHeadId);
      if (previousHeadId && previousHeadId !== id) {
        const previous = (await get(ref(database, `inhabitants/${previousHeadId}`))).val() as RegistryInhabitant | null;
        if (previous?.householdId === householdId) fields(updates, `inhabitants/${previousHeadId}`, {
          isHouseholdHead: false, relationshipToHead: previous.relationshipToHead === "Head" ? "Not recorded" : previous.relationshipToHead,
          updatedBy: uid, updatedAt: now,
        });
      }
      fields(updates, `households/${householdId}`, { householdHeadId: id, householdHeadName: clean(input.fullName) });
    } else if (household.householdHeadId === id) fields(updates, `households/${householdId}`, { householdHeadId: null, householdHeadName: null });
  }
  audit(updates, old ? "INHABITANT_UPDATED" : "INHABITANT_CREATED", uid, { householdId, inhabitantId: id, details: clean(input.fullName) });
  await update(ref(database), updates); return id;
}
