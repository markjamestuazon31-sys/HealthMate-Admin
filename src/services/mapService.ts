import {
  isActiveEmergencyStatus,
} from "../policies/emergencyPolicy";

import type {
  Emergency,
} from "../types";

import {
  listenEmergencies,
  type EmergencyDataFailure,
} from "./emergencyService";

/**
 * Extra lifecycle properties written by the Android
 * SOS/respondent workflow.
 *
 * They are optional so older Firebase incidents remain readable.
 */
interface EmergencyLifecycleFields {
  alertState?: string | null;

  /**
   * True after the authorized respondent successfully
   * scans/verifies the patient's active SOS.
   */
  arrivalVerified?: boolean;

  /**
   * True after the final emergency-response report
   * formally completes the operational response.
   */
  responseCompleted?: boolean;

  completedAt?: number;
  completedBy?: string;

  cancelledAt?: number;
  cancelledBy?: string;
}

/**
 * Converts Firebase values into a consistent state value.
 */
function normalizeState(
  value: unknown,
): string {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase();
}

/**
 * Reads newer lifecycle properties while keeping
 * compatibility with the existing Emergency interface.
 */
function getLifecycle(
  emergency: Emergency,
): EmergencyLifecycleFields {
  return emergency as Emergency &
    EmergencyLifecycleFields;
}

/**
 * These incident statuses must not appear on the
 * ACTIVE administrator live map.
 */
const NON_LIVE_STATUSES =
  new Set<string>([
    /*
     * Final/coordinator report submitted.
     */
    "REPORT_SUBMITTED",

    /*
     * Administrator already reviewed the completed report.
     */
    "ADMIN_REVIEWED",

    /*
     * Incident formally closed.
     */
    "CLOSED",

    /*
     * User cancelled/stopped the SOS.
     */
    "CANCELLED",
  ]);

/**
 * Explicit Android SOS alert states that remove the
 * active red SOS overlay.
 */
const NON_LIVE_ALERT_STATES =
  new Set<string>([
    /*
     * Patient explicitly stopped SOS.
     */
    "STOPPED",

    /*
     * Final response completed.
     */
    "COMPLETED",

    "CANCELLED",
    "CLOSED",
  ]);

/**
 * Returns true only when the incident must remain visible
 * as an ACTIVE red SOS on the administrator live map.
 *
 * IMPORTANT:
 *
 * GPS STALENESS DOES NOT REMOVE THE SOS.
 *
 * A stale or temporarilyALENESS DOES NOT REMOVE THE SOS.
 *
 * A stale offline patient remains visible
 * at the last known valid coordinates.
 *
 * SOS disappears only when:
 *
 * 1. the USER stops/cancels SOS;
 * 2. the RESPONDENT submits the final completion report; or
 * 3. the ADMIN completes/reviews/closes the incident.
 *
 * Respondent arrival verification does NOT remove the red SOS. It only means
 * the responder reached the patient and the response remains operational.
 */
export function isLiveSosMapIncident(
  emergency: Emergency,
): boolean {
  const lifecycle =
    getLifecycle(
      emergency,
    );

  const status =
    normalizeState(
      emergency.status,
    );

  const alertState =
    normalizeState(
      lifecycle.alertState,
    );

  /*
   * ---------------------------------------------------------
   * 1. USER STOP / CANCEL
   * ---------------------------------------------------------
   */
  if (
    status === "CANCELLED" ||
    alertState === "STOPPED"
  ) {
    return false;
  }

  /*
   * ---------------------------------------------------------
   * 2. FINAL RESPONDER REPORT
   * ---------------------------------------------------------
   *
   * Once the final response report completes the emergency,
   * the red operational SOS leaves the live map.
   *
   * The incident itself remains stored for admin review.
   */
  if (
    status ===
      "REPORT_SUBMITTED" ||
    lifecycle.responseCompleted ===
      true ||
    alertState ===
      "COMPLETED"
  ) {
    return false;
  }

  /*
   * ---------------------------------------------------------
   * 3. ADMINISTRATIVE COMPLETION
   * ---------------------------------------------------------
   */
  if (
    status ===
      "ADMIN_REVIEWED" ||
    status ===
      "CLOSED" ||
    alertState ===
      "CLOSED"
  ) {
    return false;
  }

  /*
   * Defensive protection for any additional
   * terminal values listed above.
   */
  if (
    NON_LIVE_STATUSES.has(
      status,
    )
  ) {
    return false;
  }

  if (
    NON_LIVE_ALERT_STATES.has(
      alertState,
    )
  ) {
    return false;
  }

  /*
   * ---------------------------------------------------------
   * NORMAL ACTIVE SOS
   * ---------------------------------------------------------
   *
   * This deliberately does NOT check:
   *
   * - GPS age;
   * - last location update;
   * - respondent count;
   * - whether admin opened the case;
   * - whether the phone is temporarily offline.
   *
   * Those conditions must never remove an otherwise-active SOS.
   */
  return isActiveEmergencyStatus(
    emergency.status,
  );
}

/**
 * Real-time source used by EmergencyMap.tsx.
 *
 * listenEmergencies() provides the normalized incident collection.
 * This service filters only the incidents that still belong on the
 * ACTIVE SOS live map.
 */
export function listenActiveEmergencies(
  callback: (
    data: Emergency[],
  ) => void,

  onError?: (
    failure: EmergencyDataFailure,
  ) => void,
): () => void {
  return listenEmergencies(
    (
      emergencies:
        Emergency[],
    ) => {
      const activeIncidents =
        emergencies.filter(
          isLiveSosMapIncident,
        );

      callback(
        activeIncidents,
      );
    },

    onError,
  );
}