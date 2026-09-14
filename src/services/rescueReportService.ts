import { get, onValue, push, ref, serverTimestamp, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type { RescueReportBundle, RescueReviewStatus } from "../types";
import {
  buildRescueReportCollection, finalReportRevision, recordMap, REPORT_CLASSIFICATIONS,
  reportText, type RescueReportCollection, type RescueReportSources,
} from "./rescueReportModel";

export interface RescueReportWorkspace extends RescueReportCollection {
  ready: boolean;
  errors: Partial<Record<keyof RescueReportSources, string>>;
}
export const EMPTY_RESCUE_WORKSPACE: RescueReportWorkspace = {
  cases: [], entries: [], folders: [], ready: false, errors: {},
};
const SOURCE_PATHS: (keyof RescueReportSources)[] = ["rescueReports", "emergencies", "users", "respondents"];

/** Wait for all four initial reads; retain the canonical Android report paths. */
export function listenRescueReportWorkspace(callback: (value: RescueReportWorkspace) => void): () => void {
  let active = true;
  const sources: RescueReportSources = { rescueReports: {}, emergencies: {}, users: {}, respondents: {} };
  const settled = new Set<keyof RescueReportSources>();
  const errors: RescueReportWorkspace["errors"] = {};
  const publish = () => {
    if (!active) return;
    const ready = settled.size === SOURCE_PATHS.length;
    const collection = ready ? buildRescueReportCollection(sources) : { cases: [], entries: [], folders: [] };
    callback({ ...collection, ready, errors: { ...errors } });
  };
  callback({ ...EMPTY_RESCUE_WORKSPACE });
  const unsubscribers = SOURCE_PATHS.map(path => onValue(ref(database, path), snapshot => {
    if (!active) return;
    sources[path] = recordMap(snapshot.val());
    settled.add(path);
    delete errors[path];
    publish();
  }, error => {
    if (!active) return;
    sources[path] = {};
    settled.add(path);
    errors[path] = error.message || `Unable to read ${path}.`;
    console.error(`HealthMate rescue reports: /${path}`, error);
    publish();
  }));
  return () => { active = false; unsubscribers.forEach(stop => stop()); };
}

/** Keeps Reports Center and other existing consumers compatible. */
export function listenRescueReports(
  callback: (items: RescueReportBundle[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return listenRescueReportWorkspace(workspace => {
    if (!workspace.ready) return;
    const failure = workspace.errors.rescueReports || workspace.errors.emergencies;
    if (failure) { onError?.(new Error(failure)); return; }
    callback(workspace.cases);
  });
}

function incidentKey(value: string): string {
  const key = value.trim();
  if (!key || /[.#$\[\]/]/.test(key)) throw new Error("A valid incident ID is required.");
  return key;
}

async function currentCase(incidentId: string, expectedRevision?: string) {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired. Sign in again.");
  const id = incidentKey(incidentId);
  const [finalSnapshot, incidentSnapshot] = await Promise.all([
    get(ref(database, `rescueReports/${id}/final`)),
    get(ref(database, `emergencies/${id}`)),
  ]);
  if (auth.currentUser?.uid !== actor.uid) throw new Error("The signed in account changed. Reopen the report.");
  if (!finalSnapshot.exists()) throw new Error("The final report is no longer available.");
  if (!incidentSnapshot.exists()) throw new Error("The incident is no longer available. Its report remains in the folder.");
  const final = finalSnapshot.val() as Record<string, unknown>;
  const incident = incidentSnapshot.val() as Record<string, unknown>;
  const status = reportText(incident.status).toUpperCase();
  if (["CLOSED", "CANCELLED", "RESOLVED"].includes(status)) {
    throw new Error("This incident is already closed or cancelled. Its reports are read only.");
  }
  if (expectedRevision && finalReportRevision(final) !== expectedRevision) {
    throw new Error("The respondent updated this report. Close and reopen it before recording a decision.");
  }
  return { id, actor, final, incident, status };
}

export async function reviewFinalReport(
  incidentId: string,
  reviewStatus: Exclude<RescueReviewStatus, "PENDING_REVIEW">,
  reviewNotes: string,
  expectedRevision?: string,
) {
  if (!["APPROVED", "RETURNED_FOR_CORRECTION", "INVESTIGATION"].includes(reviewStatus)) {
    throw new Error("Choose a valid review decision.");
  }
  const notes = reviewNotes.trim();
  if (reviewStatus !== "APPROVED" && !notes) throw new Error("Add a note explaining the correction or investigation needed.");
  if (notes.length > 5000) throw new Error("Review notes must be 5,000 characters or fewer.");
  const { id, actor, final, incident } = await currentCase(incidentId, expectedRevision);
  if (reviewStatus === "APPROVED" && (
    !reportText(final.summary) || !REPORT_CLASSIFICATIONS.includes(reportText(final.classification))
    || !(reportText(final.coordinatorUid) || reportText(incident.coordinatorResponderId))
  )) throw new Error("The final report needs its coordinator, classification and summary before approval.");
  const auditId = push(ref(database, "auditLogs")).key;
  if (!auditId) throw new Error("Unable to create the review record. Try again.");
  const now = serverTimestamp();
  const nextStatus = reviewStatus === "APPROVED" ? "ADMIN_REVIEWED" : "REPORT_SUBMITTED";
  await update(ref(database), {
    [`rescueReports/${id}/final/reviewStatus`]: reviewStatus,
    [`rescueReports/${id}/final/reviewNotes`]: notes,
    [`rescueReports/${id}/final/reviewedBy`]: actor.uid,
    [`rescueReports/${id}/final/reviewedAt`]: now,
    [`rescueReports/${id}/final/updatedAt`]: now,
    [`emergencies/${id}/status`]: nextStatus,
    [`emergencies/${id}/updatedAt`]: now,
    [`emergencies/${id}/adminReviewedAt`]: reviewStatus === "APPROVED" ? now : null,
    [`incidentAnalytics/${id}/status`]: nextStatus,
    [`incidentAnalytics/${id}/updatedAt`]: now,
    [`auditLogs/${auditId}`]: {
      action: `Rescue report ${reviewStatus.toLowerCase()}`, performedBy: actor.uid,
      incidentId: id, details: notes, timestamp: now,
    },
  });
}

export async function closeReviewedIncident(incidentId: string, expectedRevision?: string) {
  const { id, actor, final, status } = await currentCase(incidentId, expectedRevision);
  if (reportText(final.reviewStatus).toUpperCase() !== "APPROVED" || status !== "ADMIN_REVIEWED") {
    throw new Error("Approve the coordinator's final report before closing this incident.");
  }
  const auditId = push(ref(database, "auditLogs")).key;
  if (!auditId) throw new Error("Unable to create the closure record. Try again.");
  const now = serverTimestamp();
  await update(ref(database), {
    [`emergencies/${id}/status`]: "CLOSED", [`emergencies/${id}/closedAt`]: now,
    [`emergencies/${id}/updatedAt`]: now,
    [`incidentAnalytics/${id}/status`]: "CLOSED", [`incidentAnalytics/${id}/updatedAt`]: now,
    [`incidentAnalytics/${id}/resolvedAt`]: now,
    [`auditLogs/${auditId}`]: {
      action: "Reviewed emergency incident closed", performedBy: actor.uid, incidentId: id,
      details: "Final rescue report approved and incident closed.", timestamp: now,
    },
  });
}
