import { onDisconnect, onValue, ref, serverTimestamp, update } from "firebase/database";
import { database } from "../firebase/config";
import {
  buildAdminDispatchRecord,
  type AdminDispatchIdentity,
} from "./adminDispatchContract";

export { buildAdminDispatchRecord } from "./adminDispatchContract";
export type { AdminDispatchIdentity, AdminDispatchRecord } from "./adminDispatchContract";

export type AdminDispatchErrorHandler = (error: Error) => void;

/**
 * Registers an authenticated web administrator in the exact dispatch path
 * consumed by the Android SOS repository.
 *
 * The account remains an active dispatch recipient while authorized. Only the
 * online flag changes with browser connectivity, which allows Android to fan
 * out SOS incidents even when the portal is not currently open.
 */
export function registerAdminDispatchPresence(
  identity: AdminDispatchIdentity,
  onError?: AdminDispatchErrorHandler,
) {
  const presenceRef = ref(database, `emergencyDispatchRecipients/admins/${identity.uid}`);
  const connectedRef = ref(database, ".info/connected");
  let stopped = false;
  let disconnectOperation: ReturnType<typeof onDisconnect> | null = null;

  const reportError = (value: unknown) => {
    const error = value instanceof Error ? value : new Error("Unable to register administrator SOS dispatch presence.");
    console.error("Unable to register administrator SOS dispatch presence", error);
    onError?.(error);
  };

  const unsubscribe = onValue(
    connectedRef,
    async (snapshot) => {
      if (stopped || snapshot.val() !== true) return;

      try {
        disconnectOperation = onDisconnect(presenceRef);
        await disconnectOperation.update({
          online: false,
          updatedAt: serverTimestamp(),
        });
        await update(presenceRef, buildAdminDispatchRecord(identity, serverTimestamp()));
      } catch (error) {
        reportError(error);
      }
    },
    reportError,
  );

  return async () => {
    stopped = true;
    unsubscribe();
    try {
      await disconnectOperation?.cancel();
      await update(presenceRef, {
        online: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("Unable to close administrator dispatch presence", error);
    }
  };
}
