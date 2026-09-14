import { normalizeEmergencyStatus } from "../policies/emergencyPolicy";
import type {
  Emergency,
  EmergencyLocationPoint,
  EmergencyMedicalSummary,
  EmergencyPatientProfile,
  EmergencyPriority,
  EmergencyResponderResponse,
} from "../types";

type UnknownRecord = Record<string, unknown>;
type RecordMap = Record<string, UnknownRecord>;
type NestedRecordMap = Record<string, RecordMap>;

export interface EmergencyBuildInput {
  emergencyRaw: RecordMap;
  locationRaw: RecordMap;
  responseRaw: NestedRecordMap;
  userRaw: RecordMap;
  medicalRaw: RecordMap;
  respondentRaw: RecordMap;
  recipientRaw?: Record<string, Record<string, boolean>>;
  liveLocationRaw?: RecordMap;
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = optionalString(value);
    if (normalized) return normalized;
  }
  return undefined;
}

export function normalizePriority(value: unknown): EmergencyPriority {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CRITICAL") return "CRITICAL";
  if (normalized === "MEDIUM" || normalized === "MODERATE") return "MEDIUM";
  if (normalized === "LOW") return "LOW";
  return "HIGH";
}

export const normalizeStatus = normalizeEmergencyStatus;

function normalizeResponderStatus(value: unknown): EmergencyResponderResponse["responseStatus"] {
  const normalized = String(value ?? "ACCEPTED").trim().toUpperCase().replace(/[-\s]+/g, "_");
  const allowed: EmergencyResponderResponse["responseStatus"][] = [
    "ACCEPTED",
    "RESPONDING",
    "EN_ROUTE",
    "ON_SCENE",
    "AGENCY_CONTACTED",
    "RESCUE_IN_PROGRESS",
    "WITHDRAWN",
  ];
  return allowed.includes(normalized as EmergencyResponderResponse["responseStatus"])
    ? (normalized as EmergencyResponderResponse["responseStatus"])
    : "ACCEPTED";
}

function normalizeLocationPoint(value: UnknownRecord | undefined): EmergencyLocationPoint | undefined {
  if (!value) return undefined;
  const latitude = toNumber(value.latitude);
  const longitude = toNumber(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    return undefined;
  }
  return {
    latitude,
    longitude,
    accuracy: toNumber(value.accuracy) || undefined,
    updatedAt: toNumber(value.updatedAt ?? value.timestamp),
  };
}


function resolveBestLocation(
  incidentLocation: EmergencyLocationPoint | undefined,
  liveLocation: EmergencyLocationPoint | undefined,
  legacyPoint: EmergencyLocationPoint | undefined,
): EmergencyLocationPoint | undefined {
  const candidates = [
    incidentLocation
      ? { point: incidentLocation, source: "incident" as const, rank: 3 }
      : null,
    liveLocation
      ? { point: liveLocation, source: "live_location" as const, rank: 2 }
      : null,
    legacyPoint
      ? { point: legacyPoint, source: "legacy" as const, rank: 1 }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (candidates.length === 0) return undefined;

  candidates.sort((first, second) => {
    const timeDifference = second.point.updatedAt - first.point.updatedAt;
    return timeDifference !== 0 ? timeDifference : second.rank - first.rank;
  });

  const selected = candidates[0];
  return {
    ...selected.point,
    source: selected.source,
  };
}

function normalizePatientProfile(uid: string, value: UnknownRecord | undefined): EmergencyPatientProfile | undefined {
  if (!uid || !value) return undefined;
  return {
    uid,
    fullName: firstString(value.fullName, value.name) || "HealthMate user",
    email: optionalString(value.email),
    phone: optionalString(value.phone),
    contactNumber: firstString(value.contactNumber, value.phone),
    profileImage: optionalString(value.profileImage),
    address: optionalString(value.address),
    assignedBarangayId: optionalString(value.assignedBarangayId),
    accountStatus: firstString(value.accountStatus, value.status),
  };
}

function normalizeMedicalSummary(value: UnknownRecord | undefined): EmergencyMedicalSummary | undefined {
  if (!value) return undefined;
  const summary: EmergencyMedicalSummary = {
    bloodType: optionalString(value.bloodType),
    allergies: optionalString(value.allergies),
    conditions: firstString(value.conditions, value.medicalConditions),
    medicalConditions: firstString(value.medicalConditions, value.conditions),
    medications: optionalString(value.medications),
    emergencyNote: optionalString(value.emergencyNote),
    updatedAt: toNumber(value.updatedAt) || undefined,
  };
  return Object.values(summary).some((item) => item !== undefined) ? summary : undefined;
}

function normalizeResponses(
  raw: RecordMap | undefined,
  locationRaw: RecordMap | undefined,
  respondentRaw: RecordMap,
): Record<string, EmergencyResponderResponse> {
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([uid, value]) => {
      const responderUid = firstString(value.responderUid, value.responderId, uid) || uid;
      const responderProfile = respondentRaw[responderUid];
      const location = normalizeLocationPoint(locationRaw?.[uid] ?? locationRaw?.[responderUid]);
      const responseStatus = normalizeResponderStatus(value.responseStatus ?? value.status);
      return [uid, {
        responderUid,
        responderName: firstString(value.responderName, responderProfile?.name, responderProfile?.fullName),
        teamRole: value.teamRole === "COORDINATOR" ? "COORDINATOR" : "SUPPORTING",
        responseStatus,
        acceptedAt: toNumber(value.acceptedAt),
        updatedAt: toNumber(value.updatedAt, toNumber(value.acceptedAt)),
        lastLocationUpdate: location?.updatedAt || toNumber(value.lastLocationUpdate) || undefined,
        notes: firstString(value.notes, value.responseNotes),
        backupRequested: Boolean(value.backupRequested),
        active: value.active !== false && responseStatus !== "WITHDRAWN",
        location,
      }];
    }),
  );
}

export function normalizeEmergency(
  id: string,
  value: UnknownRecord,
  locationValue: UnknownRecord | undefined,
  responseValue: RecordMap | undefined,
  userValue: UnknownRecord | undefined,
  medicalValue: UnknownRecord | undefined,
  respondentRaw: RecordMap,
  liveLocationValue?: UnknownRecord,
  recipientValue?: Record<string, boolean>,
): Emergency {
  const legacyLocation = value.location as UnknownRecord | undefined;
  const incidentLocation = normalizeLocationPoint(
    (locationValue?.patient as UnknownRecord | undefined) ?? locationValue,
  );
  const liveLocation = normalizeLocationPoint(liveLocationValue);
  const legacyPoint = normalizeLocationPoint(legacyLocation ?? {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: value.locationAccuracy,
    updatedAt: value.locationUpdatedAt,
  });
  const resolvedLocation = resolveBestLocation(
    incidentLocation,
    liveLocation,
    legacyPoint,
  );
  const createdAt = toNumber(value.createdAt, Date.now());
  const patientUid = String(value.patientUid ?? value.userId ?? "").trim();
  const patientProfile = normalizePatientProfile(patientUid, userValue);
  const patientName = firstString(patientProfile?.fullName, value.patientName, value.userName);
  const patientPhone = firstString(
    patientProfile?.contactNumber,
    patientProfile?.phone,
    value.patientPhone,
    value.phone,
  );
  const locationSummary = (value.locationSummary as Emergency["locationSummary"] | undefined) ?? {
    barangayId: firstString(value.assignedBarangayId, patientProfile?.assignedBarangayId),
    description: "Exact coordinates are stored in the authorized incident location channel.",
  };
  const location: EmergencyLocationPoint = resolvedLocation
    ? resolvedLocation
    : { latitude: 0, longitude: 0, updatedAt: createdAt, source: "missing" };
  const priority = normalizePriority(firstString(value.severity, value.priority));

  return {
    id,
    patientUid,
    userId: patientUid,
    patientName,
    userName: patientName,
    patientPhone,
    phone: patientPhone,
    assignedBarangayId: firstString(value.assignedBarangayId, patientProfile?.assignedBarangayId),
    type: firstString(value.type) || "SOS Alert",
    description: firstString(value.description) || "Emergency assistance requested from the HealthMate Android app.",
    reportedUrgency: optionalString(value.reportedUrgency),
    urgencyReviewedBy: optionalString(value.urgencyReviewedBy),
    urgencyReviewedAt: toNumber(value.urgencyReviewedAt) || undefined,
    urgencyReviewReason: optionalString(value.urgencyReviewReason),
    urgencyHistory: value.urgencyHistory && typeof value.urgencyHistory === "object"
      ? value.urgencyHistory as Emergency["urgencyHistory"] : undefined,
    severity: priority,
    priority,
    status: normalizeStatus(value.status),
    locationSummary,
    location,
    coordinatorResponderId: optionalString(value.coordinatorResponderId),
    responseNotes: optionalString(value.responseNotes),
    alertState: optionalString(value.alertState),
    alarmActive: optionalBoolean(value.alarmActive),
    arrivalVerified: optionalBoolean(value.arrivalVerified),
    arrivalVerifiedAt: toNumber(value.arrivalVerifiedAt) || undefined,
    arrivalVerifiedBy: optionalString(value.arrivalVerifiedBy),
    adminAcknowledgedAt: toNumber(value.adminAcknowledgedAt) || undefined,
    adminAcknowledgedBy: optionalString(value.adminAcknowledgedBy),
    adminAcknowledgedName: optionalString(value.adminAcknowledgedName),
    adminAcknowledgementNotificationId: optionalString(value.adminAcknowledgementNotificationId),
    cancellationReason: optionalString(value.cancellationReason),
    cancelledBy: optionalString(value.cancelledBy),
    responders: normalizeResponses(
      responseValue ?? (value.responders as RecordMap | undefined),
      locationValue?.responders as RecordMap | undefined,
      respondentRaw,
    ),
    createdAt,
    updatedAt: toNumber(value.updatedAt, createdAt),
    closedAt: toNumber(value.closedAt) || undefined,
    cancelledAt: toNumber(value.cancelledAt) || undefined,
    patientProfile,
    medicalSummary: normalizeMedicalSummary(medicalValue),
    recipientCount: recipientValue ? Object.keys(recipientValue).length : undefined,
  };
}

export function buildEmergencyList(input: EmergencyBuildInput): Emergency[] {
  return Object.entries(input.emergencyRaw)
    .map(([id, value]) => {
      const patientUid = String(value.patientUid ?? value.userId ?? "").trim();
      return normalizeEmergency(
        id,
        value,
        input.locationRaw[id],
        input.responseRaw[id],
        input.userRaw[patientUid],
        input.medicalRaw[id],
        input.respondentRaw,
        input.liveLocationRaw?.[patientUid],
        input.recipientRaw?.[id],
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

