import { get, onValue, ref } from "firebase/database";
import { database } from "../firebase/config";
import type { HealthProfile } from "../types";

const MEDICAL_PROFILES_PATH = "medicalProfiles";

function normalizeHealthProfile(userId: string, value: Record<string, unknown>): HealthProfile {
  return {
    userId,
    bloodType: typeof value.bloodType === "string" ? value.bloodType : undefined,
    allergies: typeof value.allergies === "string" ? value.allergies : undefined,
    conditions:
      typeof value.medicalConditions === "string"
        ? value.medicalConditions
        : typeof value.conditions === "string"
          ? value.conditions
          : undefined,
    medications: typeof value.medications === "string" ? value.medications : undefined,
    emergencyNote: typeof value.emergencyNote === "string" ? value.emergencyNote : undefined,
    doctorName: typeof value.doctorName === "string" ? value.doctorName : undefined,
    doctorPhone: typeof value.doctorPhone === "string" ? value.doctorPhone : undefined,
    medicalHistory: typeof value.medicalHistory === "string" ? value.medicalHistory : undefined,
    updatedAt: Number(value.updatedAt) || undefined,
  };
}

export async function getHealthProfile(userId: string): Promise<HealthProfile | null> {
  const snapshot = await get(ref(database, `${MEDICAL_PROFILES_PATH}/${userId}`));
  if (!snapshot.exists()) return null;
  return normalizeHealthProfile(userId, snapshot.val() as Record<string, unknown>);
}

export function listenHealthProfiles(callback: (profiles: Record<string, HealthProfile>) => void) {
  return onValue(ref(database, MEDICAL_PROFILES_PATH), (snapshot) => {
    const raw = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const profiles: Record<string, HealthProfile> = {};
    if (raw) {
      Object.entries(raw).forEach(([userId, profile]) => {
        profiles[userId] = normalizeHealthProfile(userId, profile);
      });
    }
    callback(profiles);
  });
}
