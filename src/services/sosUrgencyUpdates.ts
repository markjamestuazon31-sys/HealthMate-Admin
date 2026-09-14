import { normalizeSosUrgency } from "./sosUrgency";

/** Add the review metadata to the same atomic save as the incident and analytics. */
export function appendUrgencyReview(
  updates: Record<string, unknown>, id: string, previous: unknown, next: unknown,
  actorUid: string, reason: string | undefined, now: number, eventId: string,
): void {
  const before = normalizeSosUrgency(previous);
  const after = normalizeSosUrgency(next);
  if (before === after) return;
  const note = (reason ?? "").trim();
  if (note.length < 3 || note.length > 1000) throw new Error("Enter a reason for changing SOS urgency (3 to 1000 characters).");
  if (!actorUid || !eventId) throw new Error("Unable to identify the urgency review.");
  updates[`emergencies/${id}/urgencyReviewedBy`] = actorUid;
  updates[`emergencies/${id}/urgencyReviewedAt`] = now;
  updates[`emergencies/${id}/urgencyReviewReason`] = note;
  updates[`emergencies/${id}/urgencyReviewId`] = eventId;
  updates[`emergencies/${id}/urgencyHistory/${eventId}`] = {
    previous: before, current: after, reason: note, actorUid, at: now,
  };
}
