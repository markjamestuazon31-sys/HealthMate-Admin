import {
  get,
  push,
  ref,
  update,
} from "firebase/database";

import { auth, database } from "../firebase/config";
import type {
  BackupRequest,
  BackupRequestStatus,
  Emergency,
  Responder,
} from "../types";
import { isTerminalStatus } from "../components/emergency/EmergencyStatusChip";

function buildBackupId(incidentId: string, requesterUid: string): string {
  return `${incidentId}__${requesterUid}`;
}

/**
 * Derive open backup requests from live emergency + response data.
 * Android writes: emergencyResponses/{incidentId}/{uid}/backupRequested + notes.
 */
export function deriveBackupRequests(emergencies: Emergency[]): BackupRequest[] {
  const items: BackupRequest[] = [];

  for (const emergency of emergencies) {
    if (isTerminalStatus(emergency.status)) continue;

    const responders = Object.values(emergency.responders ?? {});
    const activeCount = responders.filter((r) => r.active).length;

    for (const response of responders) {
      if (!response.backupRequested || !response.active) continue;
      if (response.backupFulfilledAt) continue;

      const notes = (response.notes ?? "").trim();
      const specialty = (response.backupSpecialty ?? "").trim() || undefined;
      const need = (response.backupNeed ?? "").trim() || undefined;
      const requestedAt =
        response.backupRequestedAt ||
        response.updatedAt ||
        emergency.updatedAt ||
        emergency.createdAt;

      let status: BackupRequestStatus = "OPEN";
      if (response.backupAdminNotifiedAt) status = "NOTIFIED";

      items.push({
        id: buildBackupId(emergency.id, response.responderUid),
        incidentId: emergency.id,
        requesterUid: response.responderUid,
        requesterName: response.responderName,
        teamRole: response.teamRole,
        patientName: emergency.patientName,
        patientUid: emergency.patientUid,
        area:
          emergency.locationSummary?.barangayName ||
          emergency.assignedBarangayId ||
          undefined,
        priority: emergency.priority,
        incidentStatus: emergency.status,
        notes,
        specialty,
        need,
        status,
        requestedAt,
        adminNotifiedAt: response.backupAdminNotifiedAt,
        fulfilledAt: response.backupFulfilledAt,
        activeResponderCount: activeCount,
      });
    }
  }

  return items.sort((a, b) => b.requestedAt - a.requestedAt);
}

export interface NotifyBackupOptions {
  /** Optional admin message appended to the push body. */
  adminMessage?: string;
  /** If true, only AVAILABLE responders are notified (default: all active respondents). */
  availableOnly?: boolean;
}

function responderKey(responder: Responder): string {
  return (responder.authUid || responder.id || "").trim();
}

async function loadActiveResponders(): Promise<Responder[]> {
  const snapshot = await get(ref(database, "respondents"));
  if (!snapshot.exists()) return [];
  const raw = snapshot.val() as Record<string, Record<string, unknown>>;
  return Object.entries(raw).map(([uid, value]) => ({
    id: uid,
    authUid: String(value.authUid ?? uid),
    role: "responder" as const,
    name: String(value.name ?? value.fullName ?? ""),
    contact: String(value.contact ?? value.phone ?? ""),
    position: String(value.position ?? ""),
    address: String(value.address ?? ""),
    assignedBarangayId: String(value.assignedBarangayId ?? ""),
    serviceArea: String(value.serviceArea ?? ""),
    accountStatus: (value.accountStatus as Responder["accountStatus"]) || "active",
    availability:
      (value.availability as Responder["availability"]) || "AVAILABLE",
    email: String(value.email ?? ""),
    createdAt: Number(value.createdAt ?? 0),
    updatedAt: Number(value.updatedAt ?? 0),
  }));
}

/**
 * Admin broadcasts a backup call to other respondents.
 * Queues HIGH emergency_backup notifications and marks the request as NOTIFIED.
 */
export async function notifyAllRespondersOfBackup(
  request: BackupRequest,
  responders?: Responder[],
  options: NotifyBackupOptions = {},
): Promise<{ notifiedCount: number }> {
  const actor = auth.currentUser;
  if (!actor) {
    throw new Error("Your administrator session has expired.");
  }

  const now = Date.now();
  const adminNote = (options.adminMessage ?? "").trim();
  const needParts = [
    request.specialty ? `Specialty: ${request.specialty}` : "",
    request.need ? `Need: ${request.need}` : "",
    request.notes ? request.notes : "",
    adminNote ? `Admin: ${adminNote}` : "",
  ].filter(Boolean);

  const needText =
    needParts.length > 0
      ? needParts.join(" · ")
      : "Additional responders requested on an active SOS.";

  const title = "Backup needed on active SOS";
  const message = [
    `${request.requesterName || "A responder"} requested backup`,
    request.patientName ? `for ${request.patientName}` : "",
    request.area ? `in ${request.area}` : "",
    `. ${needText}`,
    " Open the case in the respondent app to join.",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const pool = responders && responders.length > 0
    ? responders
    : await loadActiveResponders();

  const targets = pool.filter((responder) => {
    const key = responderKey(responder);
    if (!key) return false;
    if (responder.accountStatus !== "active") return false;
    if (key === request.requesterUid) return false;
    if (options.availableOnly && responder.availability !== "AVAILABLE") {
      return false;
    }
    return true;
  });

  if (targets.length === 0) {
    throw new Error(
      options.availableOnly
        ? "No available respondents to notify right now."
        : "No active respondents found to notify.",
    );
  }

  const updates: Record<string, unknown> = {
    [`emergencyResponses/${request.incidentId}/${request.requesterUid}/backupAdminNotifiedAt`]:
      now,
    [`emergencyResponses/${request.incidentId}/${request.requesterUid}/updatedAt`]:
      now,
    [`emergencies/${request.incidentId}/backupBroadcastAt`]: now,
    [`emergencies/${request.incidentId}/backupBroadcastBy`]: actor.uid,
    [`emergencies/${request.incidentId}/updatedAt`]: now,
  };

  for (const target of targets) {
    const targetUid = responderKey(target);
    const notificationId = push(ref(database, "notificationRequests")).key;
    if (!notificationId || !targetUid) continue;

    const common = {
      title,
      message,
      body: message,
      type: "emergency_backup",
      priority: "HIGH",
      incidentId: request.incidentId,
      emergencyId: request.incidentId,
      relatedEntityId: request.incidentId,
      requesterUid: request.requesterUid,
      createdBy: actor.uid,
      createdAt: now,
    };

    updates[`notificationRequests/${notificationId}`] = {
      ...common,
      targetUserId: targetUid,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    };
    updates[`notifications/${targetUid}/${notificationId}`] = {
      ...common,
      timestamp: now,
      read: false,
      readAt: 0,
    };
  }

  const auditId = push(ref(database, "auditLogs")).key;
  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "BACKUP_REQUEST_BROADCAST",
      performedBy: actor.uid,
      actorRole: "administrator",
      incidentId: request.incidentId,
      userId: request.requesterUid,
      details: `notified=${targets.length}; ${needText}`,
      timestamp: now,
    };
  }

  await update(ref(database), updates);
  return { notifiedCount: targets.length };
}

/**
 * Mark a backup request as fulfilled (enough help joined / no longer needed).
 */
export async function markBackupFulfilled(
  request: BackupRequest,
  note?: string,
): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) {
    throw new Error("Your administrator session has expired.");
  }

  const now = Date.now();
  const noteText = (note ?? "").trim();
  const updates: Record<string, unknown> = {
    [`emergencyResponses/${request.incidentId}/${request.requesterUid}/backupRequested`]:
      false,
    [`emergencyResponses/${request.incidentId}/${request.requesterUid}/backupFulfilledAt`]:
      now,
    [`emergencyResponses/${request.incidentId}/${request.requesterUid}/updatedAt`]:
      now,
    [`emergencies/${request.incidentId}/updatedAt`]: now,
  };

  if (noteText) {
    updates[
      `emergencyResponses/${request.incidentId}/${request.requesterUid}/notes`
    ] = noteText;
  }

  const auditId = push(ref(database, "auditLogs")).key;
  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "BACKUP_REQUEST_FULFILLED",
      performedBy: actor.uid,
      actorRole: "administrator",
      incidentId: request.incidentId,
      userId: request.requesterUid,
      details: noteText || "Backup marked fulfilled by administrator.",
      timestamp: now,
    };
  }

  await update(ref(database), updates);
}

/**
 * Load current incident responders map (for optional join validation).
 */
export async function loadIncidentResponseUids(
  incidentId: string,
): Promise<Set<string>> {
  const snapshot = await get(
    ref(database, `emergencyResponses/${incidentId}`),
  );
  if (!snapshot.exists()) return new Set();
  return new Set(Object.keys(snapshot.val() as Record<string, unknown>));
}
