import type {
  Announcement,
  AuditLog,
  Emergency,
  EmergencyDirectoryContact,
  Household,
  Inhabitant,
  RescueReportBundle,
  RespondentApplication,
  RespondentInvitation,
  Responder,
  User,
} from "../types";
import { listenAnnouncements } from "./announcementService";
import { listenAuditLogs } from "./auditService";
import { listenBunuananContacts } from "./directoryService";
import { listenEmergencies } from "./emergencyService";
import { listenHouseholds, listenInhabitants } from "./inhabitantService";
import { listenRescueReports } from "./rescueReportService";
import { listenRespondentApplications } from "./respondentApplicationService";
import { listenRespondentInvitations, listenResponders } from "./respondentInvitationService";
import { listenUsers } from "./userService";

export interface SystemReportData {
  emergencies: Emergency[];
  rescueReports: RescueReportBundle[];
  users: User[];
  households: Household[];
  inhabitants: Inhabitant[];
  respondentApplications: RespondentApplication[];
  respondentInvitations: RespondentInvitation[];
  responders: Responder[];
  directoryContacts: EmergencyDirectoryContact[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
}

export interface SystemReportSnapshot {
  data: SystemReportData;
  ready: boolean;
  syncedAt: number;
}

const EMPTY_DATA: SystemReportData = {
  emergencies: [],
  rescueReports: [],
  users: [],
  households: [],
  inhabitants: [],
  respondentApplications: [],
  respondentInvitations: [],
  responders: [],
  directoryContacts: [],
  announcements: [],
  auditLogs: [],
};

/**
 * Central live-data adapter for the Administration Reports Center.
 *
 * It intentionally reuses the same normalized listeners as the rest of the
 * HealthMate portal instead of reading raw Firebase nodes a second way. That
 * keeps report counts aligned with operational screens and prevents report
 * logic from drifting away from the application's established data model.
 */
export function listenSystemReportData(
  callback: (snapshot: SystemReportSnapshot) => void,
) {
  let active = true;
  const data: SystemReportData = { ...EMPTY_DATA };
  const loaded = new Set<keyof SystemReportData>();

  const publish = <K extends keyof SystemReportData>(
    key: K,
    value: SystemReportData[K],
  ) => {
    if (!active) return;
    data[key] = value;
    loaded.add(key);

    callback({
      data: {
        emergencies: [...data.emergencies],
        rescueReports: [...data.rescueReports],
        users: [...data.users],
        households: [...data.households],
        inhabitants: [...data.inhabitants],
        respondentApplications: [...data.respondentApplications],
        respondentInvitations: [...data.respondentInvitations],
        responders: [...data.responders],
        directoryContacts: [...data.directoryContacts],
        announcements: [...data.announcements],
        auditLogs: [...data.auditLogs],
      },
      ready: loaded.size === Object.keys(EMPTY_DATA).length,
      syncedAt: Date.now(),
    });
  };

  const unsubscribers = [
    listenEmergencies((items) => publish("emergencies", items)),
    listenRescueReports((items) => publish("rescueReports", items)),
    listenUsers((items) => publish("users", items)),
    listenHouseholds((items) => publish("households", items)),
    listenInhabitants((items) => publish("inhabitants", items)),
    listenRespondentApplications((items) => publish("respondentApplications", items)),
    listenRespondentInvitations((items) => publish("respondentInvitations", items)),
    listenResponders((items) => publish("responders", items)),
    listenBunuananContacts((items) => publish("directoryContacts", items)),
    listenAnnouncements((items) => publish("announcements", items)),
    listenAuditLogs((items) => publish("auditLogs", items)),
  ];

  return () => {
    active = false;
    unsubscribers.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
  };
}

/** Backward-compatible export retained for any older imports. */
export const listenEmergencyReports = listenEmergencies;
