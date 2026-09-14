import { appendUrgencyReview } from "./sosUrgencyUpdates";
import { normalizeSosUrgency } from "./sosUrgency";
import {
  get,
  push,
  ref,
  update,
} from "firebase/database";

import {
  auth,
  database,
} from "../firebase/config";

import type {
  EmergencyPriority,
} from "../types";

export type AdminSosStatus =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "ACCEPTED"
  | "RESPONDING"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "AGENCY_CONTACTED"
  | "RESCUE_IN_PROGRESS"
  | "REPORT_SUBMITTED"
  | "ADMIN_REVIEWED"
  | "CLOSED"
  | "CANCELLED";

export interface NotificationRequestOptions {
  type?: string;
  priority?: "HIGH" | "NORMAL";
  incidentId?: string;
  emergencyId?: string;
  relatedEntityId?: string;
  createdBy?: string;
  data?: Record<string, string>;
}

export interface AdminSosUpdateInput {
  incidentId: string;
  status: AdminSosStatus;
  title: string;
  message: string;
  note?: string;
}

export interface AdminSosUpdateResult {
  incidentId: string;
  notificationId: string;
  patientUid: string;
  queued: boolean;
}

export interface AcknowledgeSosInput {
  urgencyReason?: string;
  incidentId: string;
  note?: string;
  priority?: EmergencyPriority;
}

export interface AcknowledgeSosResult {
  incidentId: string;
  notificationId: string;
  patientUid: string;
  alreadyAcknowledged: boolean;
}

interface AdminRecord {
  role?: string;
  status?: string;
  accountStatus?: string;
  active?: boolean;
  fullName?: string;
  name?: string;
}

type UnknownObject = {
  [key: string]: unknown;
};

const ADMIN_ACK_TITLE =
  "Your SOS has been received";

const ADMIN_ACK_MESSAGE =
  "HealthMate has received your emergency alert and the incident is being coordinated. " +
  "Keep your phone available and remain in a safe location when possible.";

function isUnknownObject(
  value: unknown,
): value is UnknownObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredText(
  value: unknown,
  label: string,
): string {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

function optionalText(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  return "";
}

function optionalNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalBoolean(
  value: unknown,
): boolean | undefined {
  return typeof value === "boolean"
    ? value
    : undefined;
}

function parseAdminRecord(
  value: unknown,
): AdminRecord | null {
  if (!isUnknownObject(value)) {
    return null;
  }

  return {
    role: optionalText(value.role),
    status: optionalText(value.status),
    accountStatus: optionalText(value.accountStatus),
    active: optionalBoolean(value.active),
    fullName: optionalText(value.fullName),
    name: optionalText(value.name),
  };
}

function isAuthorizedAdmin(
  record: AdminRecord | null,
): boolean {
  if (!record) {
    return false;
  }

  const role = optionalText(record.role).toLowerCase();
  const accountStatus = optionalText(
    record.accountStatus || record.status,
  ).toLowerCase();

  const validRole =
    role === "administrator" ||
    role === "admin";

  const activeAccount =
    record.active !== false &&
    (
      !accountStatus ||
      accountStatus === "active" ||
      accountStatus === "approved"
    );

  return validRole && activeAccount;
}

function getPatientUid(
  incidentValue: UnknownObject,
): string {
  const rawPatientUid =
    incidentValue.patientUid ??
    incidentValue.userId ??
    incidentValue.createdBy;

  if (typeof rawPatientUid === "string") {
    return rawPatientUid.trim();
  }

  if (isUnknownObject(rawPatientUid)) {
    return optionalText(rawPatientUid.uid);
  }

  return "";
}

function normalizeStatus(value: AdminSosStatus): AdminSosStatus {
  const normalized = requiredText(
    value,
    "Emergency status",
  ).toUpperCase();

  const allowed: AdminSosStatus[] = [
    "PENDING",
    "ACKNOWLEDGED",
    "ACCEPTED",
    "RESPONDING",
    "EN_ROUTE",
    "ON_SCENE",
    "AGENCY_CONTACTED",
    "RESCUE_IN_PROGRESS",
    "REPORT_SUBMITTED",
    "ADMIN_REVIEWED",
    "CLOSED",
    "CANCELLED",
  ];

  const match = allowed.find(
    (item) => item === normalized,
  );

  if (!match) {
    throw new Error(
      `Unsupported emergency status: ${normalized}`,
    );
  }

  return match;
}

async function loadAuthorizedAdminAndIncident(
  incidentId: string,
) {
  const currentAdmin = auth.currentUser;

  if (!currentAdmin) {
    throw new Error(
      "Your administrator session has expired. Sign in again.",
    );
  }

  const [
    adminSnapshot,
    adminUserSnapshot,
    incidentSnapshot,
  ] = await Promise.all([
    get(ref(database, `admins/${currentAdmin.uid}`)),
    get(ref(database, `users/${currentAdmin.uid}`)),
    get(ref(database, `emergencies/${incidentId}`)),
  ]);

  const rawAdmin = adminSnapshot.exists()
    ? adminSnapshot.val()
    : adminUserSnapshot.exists()
      ? adminUserSnapshot.val()
      : null;

  const adminRecord = parseAdminRecord(rawAdmin);

  if (!isAuthorizedAdmin(adminRecord)) {
    throw new Error(
      "This account is not authorized to send emergency updates.",
    );
  }

  if (!incidentSnapshot.exists()) {
    throw new Error(
      "The SOS incident no longer exists.",
    );
  }

  const rawIncident = incidentSnapshot.val();

  if (!isUnknownObject(rawIncident)) {
    throw new Error(
      "The SOS incident record is invalid.",
    );
  }

  const patientUid = getPatientUid(rawIncident);

  if (!patientUid) {
    throw new Error(
      "The SOS incident has no patient user ID.",
    );
  }

  const adminName =
    optionalText(adminRecord?.fullName || adminRecord?.name) ||
    currentAdmin.displayName ||
    currentAdmin.email ||
    "HealthMate administrator";

  return {
    currentAdmin,
    adminRecord,
    adminName,
    incidentValue: rawIncident,
    patientUid,
  };
}

export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  options: NotificationRequestOptions = {},
): Promise<string> {
  const currentAdmin = auth.currentUser;

  if (!currentAdmin) {
    throw new Error(
      "Your administrator session has expired. Sign in again.",
    );
  }

  const targetUserId = requiredText(
    userId,
    "Target user ID",
  );
  const normalizedTitle = requiredText(
    title,
    "Notification title",
  );
  const normalizedMessage = requiredText(
    message,
    "Notification message",
  );

  if (normalizedTitle.length > 120) {
    throw new Error(
      "Notification title must be 120 characters or fewer.",
    );
  }

  if (normalizedMessage.length > 2000) {
    throw new Error(
      "Notification message must be 2,000 characters or fewer.",
    );
  }

  const notificationId = push(
    ref(database, "notificationRequests"),
  ).key;

  if (!notificationId) {
    throw new Error(
      "Unable to create the notification request.",
    );
  }

  const now = Date.now();
  const incidentId = optionalText(
    options.incidentId ?? options.emergencyId,
  );
  const type = optionalText(options.type) || "general";
  const priority =
    options.priority === "HIGH"
      ? "HIGH"
      : "NORMAL";
  const createdBy =
    optionalText(options.createdBy) || currentAdmin.uid;

  const commonData: UnknownObject = {
    title: normalizedTitle,
    message: normalizedMessage,
    body: normalizedMessage,
    type,
    priority,
    incidentId,
    emergencyId: incidentId,
    relatedEntityId:
      optionalText(options.relatedEntityId) || incidentId,
    createdBy,
    createdAt: now,
    ...(options.data ?? {}),
  };

  const updates: UnknownObject = {
    [`notificationRequests/${notificationId}`]: {
      ...commonData,
      targetUserId,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    },
    [`notifications/${targetUserId}/${notificationId}`]: {
      ...commonData,
      timestamp: now,
      read: false,
      readAt: 0,
    },
  };

  await update(ref(database), updates);

  return notificationId;
}

/**
 * Administrator acknowledgement is an administrative event, not a responder
 * status. The Android respondent flow remains authoritative for ACCEPTED,
 * RESPONDING, EN_ROUTE and ON_SCENE.
 */
export async function acknowledgeSosAndNotifyUser(
  input: AcknowledgeSosInput,
): Promise<AcknowledgeSosResult> {
  const incidentId = requiredText(
    input.incidentId,
    "Incident ID",
  );

  const context = await loadAuthorizedAdminAndIncident(
    incidentId,
  );

  const incidentStatus = optionalText(
    context.incidentValue.status,
  ).toUpperCase();
  const alertState = optionalText(
    context.incidentValue.alertState,
  ).toUpperCase();

  if (
    incidentStatus === "CLOSED" ||
    incidentStatus === "CANCELLED" ||
    alertState === "STOPPED"
  ) {
    throw new Error(
      "This SOS is no longer active and cannot be acknowledged.",
    );
  }

  const existingAcknowledgedAt = optionalNumber(
    context.incidentValue.adminAcknowledgedAt,
  );
  const existingNotificationId = optionalText(
    context.incidentValue.adminAcknowledgementNotificationId,
  );

  if (existingAcknowledgedAt > 0) {
    return {
      incidentId,
      notificationId:
        existingNotificationId || "already-acknowledged",
      patientUid: context.patientUid,
      alreadyAcknowledged: true,
    };
  }

  const notificationId = push(
    ref(database, "notificationRequests"),
  ).key;
  const eventId = push(
    ref(database, `emergencyEvents/${incidentId}`),
  ).key;
  const auditId = push(
    ref(database, "auditLogs"),
  ).key;

  if (!notificationId || !eventId || !auditId) {
    throw new Error(
      "Unable to allocate the SOS acknowledgement records.",
    );
  }

  const now = Date.now();
  const note = optionalText(input.note);
  const priority = input.priority ? normalizeSosUrgency(input.priority) : "";
  const actorUid = context.currentAdmin.uid;

  const notificationCommon = {
    title: ADMIN_ACK_TITLE,
    message: ADMIN_ACK_MESSAGE,
    body: ADMIN_ACK_MESSAGE,
    type: "emergency_admin_acknowledged",
    priority: "HIGH",
    incidentId,
    emergencyId: incidentId,
    relatedEntityId: incidentId,
    createdBy: actorUid,
    senderName: context.adminName,
    senderRole: "administrator",
    emergencyStatus: incidentStatus || "PENDING",
    createdAt: now,
  };

  const updates: UnknownObject = {
    [`emergencies/${incidentId}/adminAcknowledgedAt`]: now,
    [`emergencies/${incidentId}/adminAcknowledgedBy`]: actorUid,
    [`emergencies/${incidentId}/adminAcknowledgedName`]: context.adminName,
    [`emergencies/${incidentId}/adminAcknowledgementNotificationId`]: notificationId,
    [`emergencies/${incidentId}/updatedAt`]: now,
    [`emergencies/${incidentId}/lastAdminUpdate`]: {
      type: "ADMIN_ACKNOWLEDGED_SOS",
      title: ADMIN_ACK_TITLE,
      message: ADMIN_ACK_MESSAGE,
      note,
      adminUid: actorUid,
      adminName: context.adminName,
      createdAt: now,
    },
    [`emergencyEvents/${incidentId}/${eventId}`]: {
      action: "ADMIN_ACKNOWLEDGED_SOS",
      type: "ADMIN_ACKNOWLEDGEMENT",
      incidentId,
      status: incidentStatus || "PENDING",
      title: ADMIN_ACK_TITLE,
      message: ADMIN_ACK_MESSAGE,
      note,
      actorUid,
      actorName: context.adminName,
      actorRole: "administrator",
      targetUserId: context.patientUid,
      notificationId,
      createdAt: now,
    },
    [`auditLogs/${auditId}`]: {
      action: "ADMIN_ACKNOWLEDGED_SOS",
      entityType: "emergency",
      entityId: incidentId,
      actorUid,
      actorName: context.adminName,
      actorRole: "administrator",
      targetUserId: context.patientUid,
      notificationId,
      timestamp: now,
    },
    [`notificationRequests/${notificationId}`]: {
      ...notificationCommon,
      targetUserId: context.patientUid,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    },
    [`notifications/${context.patientUid}/${notificationId}`]: {
      ...notificationCommon,
      timestamp: now,
      read: false,
      readAt: 0,
    },
  };

  if (note) {
    updates[`emergencies/${incidentId}/responseNotes`] = note;
  }

  if (priority) {
    updates[`emergencies/${incidentId}/severity`] = priority;
    updates[`emergencies/${incidentId}/priority`] = priority;
    updates[`incidentAnalytics/${incidentId}/priority`] = priority;
    updates[`incidentAnalytics/${incidentId}/updatedAt`] = now;
    appendUrgencyReview(updates, incidentId, context.incidentValue.severity || context.incidentValue.priority,
      priority, actorUid, input.urgencyReason, now, eventId);
  }

  await update(ref(database), updates);

  return {
    incidentId,
    notificationId,
    patientUid: context.patientUid,
    alreadyAcknowledged: false,
  };
}

/**
 * Compatibility method retained for other admin components. It never removes
 * emergencyLocations. Use acknowledgeSosAndNotifyUser for the first SOS
 * acknowledgement so the user gets the standardized "SOS received" message.
 */
export async function sendAdminSosUpdate(
  input: AdminSosUpdateInput,
): Promise<AdminSosUpdateResult> {
  const incidentId = requiredText(
    input.incidentId,
    "Incident ID",
  );
  const title = requiredText(
    input.title,
    "Notification title",
  );
  const message = requiredText(
    input.message,
    "Notification message",
  );
  const emergencyStatus = normalizeStatus(input.status);
  const note = optionalText(input.note);
  const context = await loadAuthorizedAdminAndIncident(incidentId);

  const notificationId = push(
    ref(database, "notificationRequests"),
  ).key;
  const eventId = push(
    ref(database, `emergencyEvents/${incidentId}`),
  ).key;
  const auditId = push(
    ref(database, "auditLogs"),
  ).key;

  if (!notificationId || !eventId || !auditId) {
    throw new Error(
      "Unable to allocate the emergency update records.",
    );
  }

  const now = Date.now();
  const previousStatus =
    optionalText(context.incidentValue.status) || "PENDING";
  const actorUid = context.currentAdmin.uid;

  const common = {
    title,
    message,
    body: message,
    type: "emergency_admin_update",
    priority: "HIGH",
    incidentId,
    emergencyId: incidentId,
    relatedEntityId: incidentId,
    createdBy: actorUid,
    senderName: context.adminName,
    senderRole: "administrator",
    emergencyStatus,
    createdAt: now,
  };

  const updates: UnknownObject = {
    [`emergencies/${incidentId}/status`]: emergencyStatus,
    [`emergencies/${incidentId}/updatedAt`]: now,
    [`emergencies/${incidentId}/lastAdminUpdate`]: {
      title,
      message,
      note,
      status: emergencyStatus,
      adminUid: actorUid,
      adminName: context.adminName,
      notificationId,
      createdAt: now,
    },
    [`emergencyEvents/${incidentId}/${eventId}`]: {
      action: "ADMIN_STATUS_UPDATE",
      type: "ADMIN_UPDATE",
      incidentId,
      previousStatus,
      status: emergencyStatus,
      title,
      message,
      note,
      actorUid,
      actorName: context.adminName,
      actorRole: "administrator",
      targetUserId: context.patientUid,
      notificationId,
      createdAt: now,
    },
    [`auditLogs/${auditId}`]: {
      action: "EMERGENCY_STATUS_UPDATED",
      entityType: "emergency",
      entityId: incidentId,
      previousStatus,
      newStatus: emergencyStatus,
      title,
      message,
      note,
      actorUid,
      actorName: context.adminName,
      actorRole: "administrator",
      targetUserId: context.patientUid,
      notificationId,
      timestamp: now,
    },
    [`notificationRequests/${notificationId}`]: {
      ...common,
      targetUserId: context.patientUid,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    },
    [`notifications/${context.patientUid}/${notificationId}`]: {
      ...common,
      timestamp: now,
      read: false,
      readAt: 0,
    },
  };

  if (note) {
    updates[`emergencies/${incidentId}/responseNotes`] = note;
  }

  await update(ref(database), updates);

  return {
    incidentId,
    notificationId,
    patientUid: context.patientUid,
    queued: true,
  };
}
