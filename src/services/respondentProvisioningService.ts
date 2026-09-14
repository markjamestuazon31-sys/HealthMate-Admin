import { getFunctions, httpsCallable } from "firebase/functions";
import "../firebase/config";

const functions = getFunctions();

export interface ProvisionRespondentInput {
  email: string;
  temporaryPassword: string;
  fullName: string;
  phone: string;
  position: string;
  assignedBarangayId: string;
  serviceArea?: string;
}

export interface ProvisionRespondentResult {
  uid: string;
  email: string;
  fullName: string;
  created: boolean;
  repaired: boolean;
  emailVerified: boolean;
  passwordChangeRequired: boolean;
}

const provisionAccount = httpsCallable<ProvisionRespondentInput, ProvisionRespondentResult>(
  functions,
  "provisionRespondentAccount",
);

export async function provisionRespondentAccount(
  input: ProvisionRespondentInput,
): Promise<ProvisionRespondentResult> {
  const response = await provisionAccount({
    email: input.email.trim().toLowerCase(),
    temporaryPassword: input.temporaryPassword,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    position: input.position.trim(),
    assignedBarangayId: input.assignedBarangayId.trim(),
    serviceArea: input.serviceArea?.trim() || "",
  });
  return response.data;
}
