import { get, onValue, ref, update } from "firebase/database";
import { updateProfile } from "firebase/auth";
import { auth, database } from "../firebase/config";
import type { AdminProfile, AdminProfileUpdateInput } from "../types";

const MAX_PROFILE_IMAGE_BYTES = 260_000;

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeProfile(uid: string, value: unknown): AdminProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const email = optionalString(raw.email).trim().toLowerCase();
  const role = optionalString(raw.role).trim().toLowerCase();
  const accountStatus = optionalString(raw.accountStatus ?? raw.status).trim().toLowerCase();

  if (role !== "admin" && role !== "administrator") return null;

  return {
    uid,
    email,
    role,
    accountStatus: accountStatus || "active",
    fullName: optionalString(raw.fullName),
    phone: optionalString(raw.phone),
    officeTitle: optionalString(raw.officeTitle),
    department: optionalString(raw.department),
    profileImageData: optionalString(raw.profileImageData),
    profileImageMimeType: optionalString(raw.profileImageMimeType),
    profileImageByteSize: optionalNumber(raw.profileImageByteSize),
    createdAt: optionalNumber(raw.createdAt),
    updatedAt: optionalNumber(raw.updatedAt),
  };
}

export function listenAdminProfile(
  uid: string,
  onChange: (profile: AdminProfile | null) => void,
  onError?: (error: Error) => void,
) {
  return onValue(
    ref(database, `admins/${uid}`),
    (snapshot) => onChange(normalizeProfile(uid, snapshot.val())),
    (error) => {
      console.error("Unable to load administrator profile", error);
      onError?.(error);
    },
  );
}

export async function getAdminProfile(uid: string) {
  const snapshot = await get(ref(database, `admins/${uid}`));
  return normalizeProfile(uid, snapshot.val());
}

export async function updateAdminProfile(uid: string, input: AdminProfileUpdateInput) {
  const profileRef = ref(database, `admins/${uid}`);
  const currentSnapshot = await get(profileRef);
  const current = normalizeProfile(uid, currentSnapshot.val());

  if (!current) throw new Error("Administrator profile does not exist or is invalid.");
  if (auth.currentUser?.uid !== uid) throw new Error("The authenticated administrator changed. Sign in again.");

  const fullName = cleanText(input.fullName, 120);
  if (!fullName) throw new Error("Full name is required.");

  const imageByteSize = input.profileImageByteSize ?? null;
  if (imageByteSize !== null && imageByteSize > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("The processed profile image is too large.");
  }

  const payload = {
    fullName,
    phone: cleanText(input.phone, 40),
    officeTitle: cleanText(input.officeTitle, 100),
    department: cleanText(input.department, 120),
    profileImageData: input.profileImageData?.trim() || null,
    profileImageMimeType: input.profileImageData ? input.profileImageMimeType ?? "image/jpeg" : null,
    profileImageByteSize: input.profileImageData ? imageByteSize : null,
    updatedAt: Date.now(),
  };

  await update(profileRef, payload);

  try {
    await updateProfile(auth.currentUser, { displayName: fullName });
  } catch (error) {
    console.warn("Firebase Authentication display name was not updated", error);
  }

  return { ...current, ...payload } as AdminProfile;
}
