import { onValue, push, ref, set } from "firebase/database";
import { database } from "../firebase/config";
import type { AuditLog } from "../types";

const AUDIT_LOGS_PATH = "auditLogs";

export async function createAuditLog(action: string, userId: string, details?: string) {
  const logRef = push(ref(database, AUDIT_LOGS_PATH));
  await set(logRef, {
    action: action.trim(),
    performedBy: userId,
    details: details?.trim() || "",
    timestamp: Date.now(),
  });
}

export function listenAuditLogs(callback: (logs: AuditLog[]) => void) {
  return onValue(ref(database, AUDIT_LOGS_PATH), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<AuditLog> & { user?: string }> | null;
    const logs = raw
      ? Object.entries(raw)
          .map(([id, value]) => ({
            id,
            action: value.action ?? "Administrative action",
            performedBy: value.performedBy ?? value.user,
            userId: value.userId,
            details: value.details,
            timestamp: Number(value.timestamp ?? value.createdAt) || 0,
          }))
          .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      : [];
    callback(logs);
  });
}
