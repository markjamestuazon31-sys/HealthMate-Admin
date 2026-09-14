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

export function listenAuditLogs(callback: (logs: AuditLog[]) => void, onError?: (error: Error) => void) {
  return onValue(ref(database, AUDIT_LOGS_PATH), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<AuditLog> & { user?: string; actorName?: string; actorUid?: string; targetUserId?: string; entityType?: string; entityId?: string; message?: string; note?: string }> | null;
    const logs = raw
      ? Object.entries(raw)
          .map(([id, value]) => ({
            id,
            action: value.action ?? "Administrative action",
            performedBy: value.actorName || value.performedBy || value.actorUid || value.user,
            userId: value.userId || value.targetUserId,
            incidentId: value.incidentId || (value.entityType === "emergency" ? value.entityId : undefined),
            details: value.details || [value.message, value.note].filter(Boolean).join(" • "),
            timestamp: Number(value.timestamp ?? value.createdAt) || 0,
          }))
          .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      : [];
    callback(logs);
  }, onError);
}
