import { appendUrgencyReview } from "./sosUrgencyUpdates";
import { normalizeSosUrgency } from "./sosUrgency";
import {
  get,
  onValue,
  push,
  ref,
  update,
  type DataSnapshot,
} from "firebase/database";

import { auth, database } from "../firebase/config";
import {
  canTransitionEmergencyStatus,
} from "../policies/emergencyPolicy";
import type {
  Emergency,
  EmergencyPriority,
  EmergencyStatus,
} from "../types";
import {
  buildEmergencyList,
  type EmergencyBuildInput,
} from "./emergencyNormalizer";

export { allowedNextStatuses } from "../policies/emergencyPolicy";
export {
  buildEmergencyList,
  normalizeEmergency,
  normalizePriority,
  normalizeStatus,
} from "./emergencyNormalizer";

export interface EmergencyDataFailure {
  path: string;
  error: Error;
}

export function listenEmergencies(
  callback: (data: Emergency[]) => void,
  onError?: (failure: EmergencyDataFailure) => void,
  options?: { waitForAll?: boolean },
) {
  const state: EmergencyBuildInput = {
    emergencyRaw: {},
    locationRaw: {},
    responseRaw: {},
    userRaw: {},
    medicalRaw: {},
    respondentRaw: {},
    recipientRaw: {},
    liveLocationRaw: {},
    analyticsRaw: {},
  };

  const loaded = new Set<string>();
  const expectedInitialSources = 9;
  const emit = () => {
    if (!options?.waitForAll || loaded.size === expectedInitialSources) {
      callback(buildEmergencyList(state));
    }
  };

  const listen = (
    path: string,
    assign: (snapshot: DataSnapshot) => void,
  ) =>
    onValue(
      ref(database, path),
      (snapshot) => {
        assign(snapshot);
        loaded.add(path);
        emit();
      },
      (caught) => {
        loaded.delete(path);
        const error =
          caught instanceof Error
            ? caught
            : new Error(`Unable to read ${path}.`);
        console.error(`HealthMate admin listener failed at /${path}`, caught);
        onError?.({ path: `/${path}`, error });
      },
    );

  const unsubscribers = [
    listen("emergencies", (snapshot) => {
      state.emergencyRaw = snapshot.val() ?? {};
    }),
    listen("emergencyLocations", (snapshot) => {
      state.locationRaw = snapshot.val() ?? {};
    }),
    listen("liveLocations", (snapshot) => {
      state.liveLocationRaw = snapshot.val() ?? {};
    }),
    listen("emergencyResponses", (snapshot) => {
      state.responseRaw = snapshot.val() ?? {};
    }),
    listen("users", (snapshot) => {
      state.userRaw = snapshot.val() ?? {};
    }),
    listen("emergencyMedicalSummaries", (snapshot) => {
      state.medicalRaw = snapshot.val() ?? {};
    }),
    listen("respondents", (snapshot) => {
      state.respondentRaw = snapshot.val() ?? {};
    }),
    listen("emergencyIncidentRecipients", (snapshot) => {
      state.recipientRaw = snapshot.val() ?? {};
    }),
    // Immediate map fallback: incidentAnalytics stores the SOS coordinates
    // captured at creation time. This prevents the live map from waiting for
    // the resident live-location service when emergencyLocations is missing
    // or has not synchronized yet.
    listen("incidentAnalytics", (snapshot) => {
      state.analyticsRaw = snapshot.val() ?? {};
    }),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export interface EmergencyAdminDetailsChange {
  urgencyReason?: string;
  priority: EmergencyPriority;
  responseNotes: string;
}

/**
 * Saves administrator-only operational notes and severity.
 *
 * This function deliberately does NOT:
 * - change the responder-driven incident status;
 * - remove emergencyLocations;
 * - stop patient location sharing; or
 * - send the patient a duplicate responder notification.
 */
export async function saveEmergencyAdministrativeDetails(
  emergency: Emergency,
  changes: EmergencyAdminDetailsChange,
): Promise<void> {
  const actor = auth.currentUser;

  if (!actor) {
    throw new Error("Your administrator session has expired.");
  }

  const now = Date.now();
  const auditId = push(ref(database, "auditLogs")).key;
  const responseNotes = changes.responseNotes.trim();
  changes.priority = normalizeSosUrgency(changes.priority);

  const updates: Record<string, unknown> = {
    [`emergencies/${emergency.id}/severity`]: changes.priority,
    [`emergencies/${emergency.id}/priority`]: changes.priority,
    [`emergencies/${emergency.id}/responseNotes`]: responseNotes,
    [`emergencies/${emergency.id}/updatedAt`]: now,
    [`incidentAnalytics/${emergency.id}/priority`]: changes.priority,
    [`incidentAnalytics/${emergency.id}/updatedAt`]: now,
  };

  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "EMERGENCY_ADMIN_DETAILS_UPDATED",
      performedBy: actor.uid,
      actorRole: "administrator",
      userId: emergency.patientUid,
      incidentId: emergency.id,
      details: `severity=${changes.priority}; administrative note updated`,
      timestamp: now,
    };
  }

  appendUrgencyReview(updates, emergency.id, emergency.priority, changes.priority,
    actor.uid, changes.urgencyReason, now, auditId ?? "");
  await update(ref(database), updates);
}

/**
 * Compatibility API retained for older admin components.
 *
 * The admin portal never deletes incident-scoped coordinates. Android owns the
 * two alert-stop events: patient cancellation and verified respondent arrival.
 */
export async function updateEmergencyResponse(
  emergency: Emergency,
  changes: {
    status: EmergencyStatus;
    priority: EmergencyPriority;
    responseNotes: string;
    urgencyReason?: string;
  },
): Promise<void> {
  const actor = auth.currentUser;

  if (!actor) {
    throw new Error("Your administrator session has expired.");
  }

  if (!canTransitionEmergencyStatus(emergency.status, changes.status)) {
    throw new Error(
      `Invalid transition from ${emergency.status} to ${changes.status}.`,
    );
  }

  const now = Date.now();
  const auditId = push(ref(database, "auditLogs")).key;

  const updates: Record<string, unknown> = {
    [`emergencies/${emergency.id}/status`]: changes.status,
    [`emergencies/${emergency.id}/severity`]: changes.priority,
    [`emergencies/${emergency.id}/priority`]: changes.priority,
    [`emergencies/${emergency.id}/responseNotes`]: changes.responseNotes.trim(),
    [`emergencies/${emergency.id}/updatedAt`]: now,
    [`incidentAnalytics/${emergency.id}/status`]: changes.status,
    [`incidentAnalytics/${emergency.id}/priority`]: changes.priority,
    [`incidentAnalytics/${emergency.id}/updatedAt`]: now,
  };

  if (changes.status === "CLOSED") {
    updates[`emergencies/${emergency.id}/closedAt`] = now;
    updates[`incidentAnalytics/${emergency.id}/resolvedAt`] = now;
  }

  if (changes.status === "CANCELLED") {
    updates[`emergencies/${emergency.id}/cancelledAt`] = now;
    updates[`incidentAnalytics/${emergency.id}/resolvedAt`] = now;
  }

  if (auditId) {
    updates[`auditLogs/${auditId}`] = {
      action: "EMERGENCY_INCIDENT_UPDATED",
      performedBy: actor.uid,
      actorRole: "administrator",
      userId: emergency.patientUid,
      incidentId: emergency.id,
      details: `status=${changes.status}; severity=${changes.priority}`,
      timestamp: now,
    };
  }

  appendUrgencyReview(updates, emergency.id, emergency.priority, changes.priority,
    actor.uid, changes.urgencyReason, now, auditId ?? "");
  await update(ref(database), updates);
}

export async function updateEmergencyPriority(id: string, priority: EmergencyPriority, reason?: string) {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  const snapshot = await get(ref(database, `emergencies/${id}`));
  if (!snapshot.exists()) throw new Error("This SOS incident is no longer available.");
  const current = snapshot.val();
  if (["CLOSED", "CANCELLED"].includes(String(current.status).toUpperCase())) throw new Error("This SOS is already closed.");
  const now = Date.now();
  const key = push(ref(database, "auditLogs")).key ?? "";
  const next = normalizeSosUrgency(priority);
  const updates: Record<string, unknown> = {
    [`emergencies/${id}/severity`]: next, [`emergencies/${id}/priority`]: next,
    [`emergencies/${id}/updatedAt`]: now, [`incidentAnalytics/${id}/priority`]: next,
    [`incidentAnalytics/${id}/updatedAt`]: now,
  };
  appendUrgencyReview(updates, id, current.severity || current.priority, next, actor.uid, reason, now, key);
  await update(ref(database), updates);
}

export async function addResponseNote(id: string, note: string) {
  await update(ref(database, `emergencies/${id}`), {
    responseNotes: note.trim(),
    updatedAt: Date.now(),
  });
}

export async function resolveEmergency(id: string) {
  const snapshot = await get(ref(database, `emergencies/${id}`));

  if (!snapshot.exists()) {
    throw new Error("The emergency incident no longer exists.");
  }

  const normalized = buildEmergencyList({
    emergencyRaw: {
      [id]: snapshot.val() as Record<string, unknown>,
    },
    locationRaw: {},
    responseRaw: {},
    userRaw: {},
    medicalRaw: {},
    respondentRaw: {},
    recipientRaw: {},
    liveLocationRaw: {},
  })[0];

  if (!normalized) {
    throw new Error("The emergency incident record is invalid.");
  }

  await updateEmergencyResponse(normalized, {
    status: "CLOSED",
    priority: normalized.priority,
    responseNotes: normalized.responseNotes || "",
  });
}

export async function updateEmergencyStatus(
  id: string,
  status: EmergencyStatus,
) {
  const now = Date.now();
  await update(ref(database), {
    [`emergencies/${id}/status`]: status,
    [`emergencies/${id}/updatedAt`]: now,
    [`incidentAnalytics/${id}/status`]: status,
    [`incidentAnalytics/${id}/updatedAt`]: now,
  });
}
