import { onValue, ref } from "firebase/database";
import { database } from "../firebase/config";
import type { User } from "../types";

export function listenUsers(callback: (users: User[]) => void) {
  return onValue(ref(database, "users"), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<User>> | null;
    const users: User[] = raw
      ? Object.entries(raw)
          .map(([uid, value]) => ({
            uid,
            fullName: value.fullName?.trim() || "Unnamed resident",
            email: value.email?.trim() || "",
            phone: value.phone,
            contactNumber: value.contactNumber ?? value.phone,
            address: value.address,
            assignedBarangayId: value.assignedBarangayId,
            barangayName: value.barangayName,
            householdId: value.householdId,
            inhabitantId: value.inhabitantId,
            purokId: value.purokId,
            purokLabel: value.purokLabel,
            purokVerificationStatus: value.purokVerificationStatus,
            role: value.role,
            profileImage: value.profileImage,
            qrCode: value.qrCode,
            status: value.status,
            accountStatus: value.accountStatus,
            respondentInvitationKey: value.respondentInvitationKey,
            createdAt: value.createdAt,
            updatedAt: value.updatedAt,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
      : [];
    callback(users);
  });
}
