import type { EmergencyStatus } from "../types";

const STATUS_VALUES: EmergencyStatus[] = [
  "PENDING",
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

const ALLOWED_TRANSITIONS: Readonly<Record<EmergencyStatus, readonly EmergencyStatus[]>> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["RESPONDING", "CANCELLED"],
  RESPONDING: ["EN_ROUTE", "ON_SCENE", "AGENCY_CONTACTED", "CANCELLED"],
  EN_ROUTE: ["ON_SCENE", "AGENCY_CONTACTED", "CANCELLED"],
  ON_SCENE: ["AGENCY_CONTACTED", "RESCUE_IN_PROGRESS", "REPORT_SUBMITTED", "CANCELLED"],
  AGENCY_CONTACTED: ["RESCUE_IN_PROGRESS", "REPORT_SUBMITTED", "CANCELLED"],
  RESCUE_IN_PROGRESS: ["REPORT_SUBMITTED", "CANCELLED"],
  REPORT_SUBMITTED: ["ADMIN_REVIEWED"],
  ADMIN_REVIEWED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

const LEGACY_STATUS_MAP: Readonly<Record<string, EmergencyStatus>> = {
  ACTIVE: "PENDING",
  RECEIVED: "PENDING",
  RESPONDER_ASSIGNED: "ACCEPTED",
  RESOLVED: "CLOSED",
};

export function normalizeEmergencyStatus(value: unknown): EmergencyStatus {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  const mapped = LEGACY_STATUS_MAP[normalized] ?? normalized;
  return STATUS_VALUES.includes(mapped as EmergencyStatus)
    ? (mapped as EmergencyStatus)
    : "PENDING";
}

export function allowedNextStatuses(status: EmergencyStatus): EmergencyStatus[] {
  return [...ALLOWED_TRANSITIONS[status]];
}

export function canTransitionEmergencyStatus(
  current: EmergencyStatus,
  next: EmergencyStatus,
): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].includes(next);
}

export function isActiveEmergencyStatus(status: EmergencyStatus): boolean {
  return status !== "CLOSED" && status !== "CANCELLED";
}
