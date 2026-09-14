import { onValue, ref } from "firebase/database";
import { database } from "../firebase/config";
import type { Announcement, AuditLog, Emergency, EmergencyDirectoryContact, HealthProfile, Household, IncidentAnalyticsRecord, RescueReportBundle, RespondentApplication, RespondentInvitation, Responder, User } from "../types";
import type { RegistryInhabitant } from "./inhabitantModel";
import type { MonitoringCase } from "./monitoringModel";
import type { MonitoringProgram } from "./monitoringPrograms";
import type { RespondentReportEntry } from "./rescueReportModel";
import { listenAnnouncements } from "./announcementService";
import { listenAuditLogs } from "./auditService";
import { listenBunuananContacts, listenGlobalContacts } from "./directoryService";
import { listenEmergencies } from "./emergencyService";
import { listenHouseholds, listenInhabitants } from "./inhabitantService";
import { listenRescueReportWorkspace } from "./rescueReportService";
import { listenRespondentApplications } from "./respondentApplicationService";
import { listenRespondentInvitations, listenResponders } from "./respondentInvitationService";
import { listenUsers } from "./userService";
import { listenHealthProfiles } from "./healthService";
import { listenIncidentAnalytics } from "./incidentAnalyticsService";
import { listenMonitoringCases } from "./monitoringService";
import { listenMonitoringPrograms } from "./monitoringProgramService";

export interface ReportEvent { id: string; incidentId: string; action: string; actor: string; status: string; message: string; note: string; at: number }
export interface ReportNotification { id: string; title: string; message: string; type: string; targetUserId: string; incidentId: string; status: string; attempts: number; createdAt: number; updatedAt: number }
export interface SystemReportData {
  emergencies: Emergency[]; rescueReports: RescueReportBundle[]; rescueEntries: RespondentReportEntry[];
  users: User[]; households: Household[]; inhabitants: RegistryInhabitant[];
  respondentApplications: RespondentApplication[]; respondentInvitations: RespondentInvitation[]; responders: Responder[];
  directoryContacts: EmergencyDirectoryContact[]; globalContacts: EmergencyDirectoryContact[];
  announcements: Announcement[]; auditLogs: AuditLog[]; healthProfiles: HealthProfile[];
  incidentAnalytics: IncidentAnalyticsRecord[]; monitoringCases: MonitoringCase[]; monitoringPrograms: MonitoringProgram[];
  emergencyEvents: ReportEvent[]; notifications: ReportNotification[];
}
export const REPORT_SOURCE_LABELS: Record<keyof SystemReportData, string> = {
  emergencies: "Emergency incidents", rescueReports: "Rescue cases", rescueEntries: "Respondent submissions",
  users: "Resident accounts", households: "Households", inhabitants: "Inhabitants",
  respondentApplications: "Respondent applications", respondentInvitations: "Invitations", responders: "Respondents",
  directoryContacts: "Barangay contacts", globalContacts: "National contacts", announcements: "Announcements", auditLogs: "Audit trail",
  healthProfiles: "Resident medical profiles", incidentAnalytics: "Incident heatmap", monitoringCases: "Monitoring records",
  monitoringPrograms: "Program catalog", emergencyEvents: "Emergency updates", notifications: "Notification requests",
};
export type ReportSource = keyof SystemReportData;
export type SourceStatus = "loading" | "ready" | "error";
export interface SystemReportSnapshot {
  data: SystemReportData; ready: boolean; syncedAt: number; revision: number; connected: boolean | null;
  status: Record<ReportSource, SourceStatus>; errors: Partial<Record<ReportSource, string>>;
}
export function emptySystemReportData(): SystemReportData {
  return { emergencies: [], rescueReports: [], rescueEntries: [], users: [], households: [], inhabitants: [], respondentApplications: [], respondentInvitations: [], responders: [], directoryContacts: [], globalContacts: [], announcements: [], auditLogs: [], healthProfiles: [], incidentAnalytics: [], monitoringCases: [], monitoringPrograms: [], emergencyEvents: [], notifications: [] };
}
export function emptyReportSnapshot(): SystemReportSnapshot {
  return { data: emptySystemReportData(), ready: false, syncedAt: 0, revision: 0, connected: null,
    status: Object.fromEntries(Object.keys(REPORT_SOURCE_LABELS).map(key => [key, "loading"])) as SystemReportSnapshot["status"], errors: {} };
}
const text = (v: unknown) => String(v ?? "").trim();
const number = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
function objects(v: unknown): Array<[string, Record<string, unknown>]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  return Object.entries(v).filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1] && typeof entry[1] === "object" && !Array.isArray(entry[1])));
}

/** Read only. Reuses operational adapters; no new database writes or duplicate report database. */
export function listenSystemReportData(callback: (snapshot: SystemReportSnapshot) => void) {
  let active = true;
  const state = emptyReportSnapshot();
  const stops: Array<() => void> = [];
  const emit = () => { if (active) callback({ ...state, data: { ...state.data }, status: { ...state.status }, errors: { ...state.errors }, ready: Object.values(state.status).every(s => s === "ready") }); };
  function publish<K extends ReportSource>(key: K, value: SystemReportData[K]) {
    if (!active) return;
    // Failed subscriptions stay blocked until Retry creates a fresh set of listeners.
    if (state.status[key] === "error") return;
    state.data[key] = value; state.status[key] = "ready"; state.syncedAt = Date.now(); state.revision++; emit();
  }
  function fail(key: ReportSource, error: unknown) {
    if (!active) return;
    state.data[key] = []; state.status[key] = "error";
    state.errors[key] = error instanceof Error ? error.message : "Unable to read this source.";
    state.revision++; emit();
  }
  function subscribe<K extends ReportSource>(key: K, listener: (ok: (value: SystemReportData[K]) => void, error: (e: Error) => void) => () => void) {
    try { stops.push(listener(items => publish(key, items), error => fail(key, error))); }
    catch (error) { fail(key, error); }
  }
  emit();
  stops.push(onValue(ref(database, ".info/connected"), s => { state.connected = s.val() === true; emit(); }));
  subscribe("emergencies", (ok, error) => listenEmergencies(ok, failure => error(failure.error), { waitForAll: true }));
  try { stops.push(listenRescueReportWorkspace(value => {
    const errors = Object.values(value.errors);
    if (errors.length) { fail("rescueReports", new Error(errors.join("; "))); fail("rescueEntries", new Error(errors.join("; "))); }
    else if (value.ready) { publish("rescueReports", value.cases); publish("rescueEntries", value.entries); }
  })); } catch (error) { fail("rescueReports", error); fail("rescueEntries", error); }
  subscribe("users", listenUsers); subscribe("households", listenHouseholds); subscribe("inhabitants", listenInhabitants);
  subscribe("respondentApplications", listenRespondentApplications); subscribe("respondentInvitations", listenRespondentInvitations);
  subscribe("responders", listenResponders); subscribe("directoryContacts", listenBunuananContacts); subscribe("globalContacts", listenGlobalContacts);
  subscribe("announcements", listenAnnouncements); subscribe("auditLogs", listenAuditLogs);
  subscribe("healthProfiles", (ok, error) => listenHealthProfiles(items => ok(Object.values(items)), error));
  subscribe("incidentAnalytics", listenIncidentAnalytics); subscribe("monitoringCases", listenMonitoringCases); subscribe("monitoringPrograms", listenMonitoringPrograms);
  subscribe("emergencyEvents", (ok, error) => onValue(ref(database, "emergencyEvents"), s => ok(objects(s.val()).flatMap(([incidentId, entries]) => objects(entries).map(([id, e]) => ({
    id, incidentId, action: text(e.action || e.type), actor: text(e.actorName || e.actorUid || e.performedBy), status: text(e.status || e.newStatus),
    message: text(e.message || e.title), note: text(e.note || e.reason), at: number(e.createdAt || e.timestamp || e.at),
  })))), error));
  subscribe("notifications", (ok, error) => onValue(ref(database, "notificationRequests"), s => ok(objects(s.val()).map(([id, n]) => ({
    id, title: text(n.title), message: text(n.message || n.body), type: text(n.type), targetUserId: text(n.targetUserId || n.userId),
    incidentId: text(n.incidentId || n.emergencyId), status: text(n.status) || "Not recorded", attempts: number(n.attempts), createdAt: number(n.createdAt), updatedAt: number(n.updatedAt),
  }))), error));
  return () => { active = false; stops.forEach(stop => stop()); };
}
export const listenEmergencyReports = listenEmergencies;
