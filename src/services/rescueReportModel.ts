import type {
  FinalRescueReport, IndividualRescueReport, RescueClassification,
  RescueReportBundle, RescueReviewStatus,
} from "../types";
import { buildEmergencyList } from "./emergencyNormalizer";

type RecordValue = Record<string, unknown>;
export type RecordMap = Record<string, RecordValue>;
export interface RescueReportSources {
  rescueReports: RecordMap;
  emergencies: RecordMap;
  users: RecordMap;
  respondents: RecordMap;
}
export interface ReportNarrative {
  arrivalAt?: number;
  completedAt?: number;
  observedCondition: string;
  actionsPerformed: string;
  agenciesContacted?: string;
  transportDestination?: string;
  notes?: string;
}
export interface CoordinatorReport extends FinalRescueReport, ReportNarrative {
  responderName?: string;
  sourceRevision: string;
}
export interface RescueReportCase extends RescueReportBundle {
  final?: CoordinatorReport;
}
export interface ReportRespondent {
  uid: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  photo: string;
  status: string;
}
export interface RespondentReportEntry {
  key: string;
  kind: "individual" | "final";
  ownerUid: string;
  respondent: ReportRespondent;
  incidentId: string;
  patient: string;
  submittedAt: number;
  updatedAt: number;
  classification: string;
  narrative: ReportNarrative;
  summary: string;
  isNew: boolean;
  caseReport: RescueReportCase;
}
export interface RespondentReportFolder {
  respondent: ReportRespondent;
  reports: RespondentReportEntry[];
  newCount: number;
  previousCount: number;
  latestAt: number;
}
export interface RescueReportCollection {
  cases: RescueReportCase[];
  entries: RespondentReportEntry[];
  folders: RespondentReportFolder[];
}

export const UNASSIGNED_REPORT_OWNER = "__unassigned_reports__";
export const REPORT_CLASSIFICATIONS: readonly string[] = [
  "FALSE_ALARM", "NON_CRITICAL", "CRITICAL", "RESCUED_ON_SITE",
  "TRANSPORTED_TO_HOSPITAL", "REFERRED_TO_POLICE", "REFERRED_TO_FIRE_DEPARTMENT",
  "REFERRED_TO_BARANGAY", "USER_CANCELLED", "USER_NOT_FOUND",
];
const REVIEW_STATUSES: readonly string[] = [
  "PENDING_REVIEW", "APPROVED", "RETURNED_FOR_CORRECTION", "INVESTIGATION",
];

export function reportText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : {};
}
export function recordMap(value: unknown): RecordMap {
  return Object.fromEntries(Object.entries(record(value))
    .filter(([, item]) => item !== null && typeof item === "object" && !Array.isArray(item))
    .map(([key, item]) => [key, record(item)]));
}
export function reportTimestamp(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && Number.isFinite(new Date(number).getTime()) ? number : 0;
}
function firstText(...values: unknown[]): string {
  return values.map(reportText).find(Boolean) || "";
}
export function reportLabel(value: unknown, fallback = "Not recorded"): string {
  const text = reportText(value);
  return text ? text.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : fallback;
}
export function reportDate(value: number, includeTime = true): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } as const : {}),
  }).format(value);
}
export function reportPhotoSource(value: unknown): string {
  const source = reportText(value);
  if (!source || source === "null") return "";
  if (/^https?:\/\//i.test(source) || /^data:image\/(jpeg|png|webp);base64,/i.test(source)) return source;
  if (/^[A-Za-z0-9+/=\s]+$/.test(source)) return `data:image/jpeg;base64,${source.replace(/\s/g, "")}`;
  return "";
}
function narrative(value: RecordValue): ReportNarrative {
  return {
    arrivalAt: reportTimestamp(value.arrivalAt) || undefined,
    completedAt: reportTimestamp(value.completedAt) || undefined,
    observedCondition: reportText(value.observedCondition),
    actionsPerformed: reportText(value.actionsPerformed),
    agenciesContacted: reportText(value.agenciesContacted),
    transportDestination: reportText(value.transportDestination),
    notes: reportText(value.notes),
  };
}
function respondentIdentity(uid: string, sources: RescueReportSources, savedName = ""): ReportRespondent {
  const respondent = sources.respondents[uid] || Object.values(sources.respondents)
    .find(item => reportText(item.authUid) === uid) || {};
  const user = sources.users[uid] || {};
  return {
    uid,
    name: firstText(respondent.name, respondent.fullName, user.fullName, user.name, savedName)
      || (uid === UNASSIGNED_REPORT_OWNER ? "Unassigned reports" : `Respondent ${uid.slice(-8)}`),
    email: firstText(respondent.email, user.email),
    phone: firstText(respondent.contact, respondent.phone, user.contactNumber, user.phone),
    position: firstText(respondent.position, user.position) || "Emergency respondent",
    photo: reportPhotoSource(firstText(user.profileImage, respondent.profileImage, respondent.profileImageData)),
    status: firstText(respondent.accountStatus, respondent.status, user.accountStatus, user.status),
  };
}

/** Review folders are derived views. No Android report is moved or copied. */
export function isNewRescueCase(item: RescueReportCase): boolean {
  const status = item.emergency?.status;
  return status !== "CLOSED" && status !== "CANCELLED" && item.final?.reviewStatus !== "APPROVED";
}
export function reportCaseStatus(item: RescueReportCase): { label: string; tone: string } {
  if (item.emergency?.status === "CLOSED") return { label: "Closed", tone: "neutral" };
  if (item.emergency?.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };
  if (!item.final) return { label: "Awaiting final report", tone: "neutral" };
  switch (item.final.reviewStatus) {
    case "APPROVED": return { label: "Approved", tone: "success" };
    case "RETURNED_FOR_CORRECTION": return { label: "Needs correction", tone: "warning" };
    case "INVESTIGATION": return { label: "Under investigation", tone: "warning" };
    default: return { label: "Pending review", tone: "new" };
  }
}

export function buildRescueReportCollection(sources: RescueReportSources): RescueReportCollection {
  const emergencyById = new Map(buildEmergencyList({
    emergencyRaw: sources.emergencies, userRaw: sources.users,
    respondentRaw: sources.respondents, locationRaw: {}, responseRaw: {}, medicalRaw: {},
  }).map(item => [item.id, item]));
  const cases: RescueReportCase[] = [];
  const entries: RespondentReportEntry[] = [];
  const folderMap = new Map<string, RespondentReportFolder>();
  const getFolder = (uid: string, savedName = "") => {
    let folder = folderMap.get(uid);
    if (!folder) {
      folder = {
        respondent: respondentIdentity(uid, sources, savedName), reports: [],
        newCount: 0, previousCount: 0, latestAt: 0,
      };
      folderMap.set(uid, folder);
    }
    return folder;
  };
  for (const [key, value] of Object.entries(sources.respondents)) {
    getFolder(reportText(value.authUid) || key);
  }
  for (const [uid, value] of Object.entries(sources.users)) {
    if (reportText(value.role).toLowerCase() === "responder") getFolder(uid);
  }

  for (const [incidentId, group] of Object.entries(sources.rescueReports)) {
    const rawIndividual = recordMap(group.responders);
    const responders: Record<string, IndividualRescueReport> = {};
    for (const [uid, value] of Object.entries(rawIndividual)) {
      if (!Object.keys(value).length) continue;
      responders[uid] = {
        ...narrative(value), responderUid: uid,
        responderName: respondentIdentity(uid, sources, reportText(value.responderName)).name,
        teamRole: reportText(value.teamRole).toUpperCase() === "COORDINATOR" ? "COORDINATOR" : "SUPPORTING",
        classificationRecommendation: reportText(value.classificationRecommendation) as RescueClassification,
        submittedAt: reportTimestamp(value.submittedAt),
        updatedAt: reportTimestamp(value.updatedAt) || reportTimestamp(value.submittedAt),
      };
    }
    const rawFinal = record(group.final);
    const hasFinal = Object.keys(rawFinal).length > 0;
    const ownerUid = firstText(rawFinal.coordinatorUid, sources.emergencies[incidentId]?.coordinatorResponderId);
    const rawReview = reportText(rawFinal.reviewStatus).toUpperCase();
    const final: CoordinatorReport | undefined = hasFinal ? {
      ...narrative(rawFinal), incidentId,
      sourceRevision: finalReportRevision(rawFinal),
      coordinatorUid: ownerUid,
      responderName: respondentIdentity(ownerUid || UNASSIGNED_REPORT_OWNER, sources, reportText(rawFinal.responderName)).name,
      classification: reportText(rawFinal.classification) as RescueClassification,
      summary: reportText(rawFinal.summary),
      submittedAt: reportTimestamp(rawFinal.submittedAt),
      updatedAt: reportTimestamp(rawFinal.updatedAt) || reportTimestamp(rawFinal.submittedAt),
      reviewStatus: (REVIEW_STATUSES.includes(rawReview) ? rawReview : "PENDING_REVIEW") as RescueReviewStatus,
      reviewedBy: reportText(rawFinal.reviewedBy), reviewedAt: reportTimestamp(rawFinal.reviewedAt) || undefined,
      reviewNotes: reportText(rawFinal.reviewNotes),
    } : undefined;
    if (!Object.keys(responders).length && !final) continue;
    const caseReport: RescueReportCase = { incidentId, emergency: emergencyById.get(incidentId), responders, final };
    cases.push(caseReport);
    const add = (uid: string, kind: "individual" | "final", report: IndividualRescueReport | CoordinatorReport) => {
      const folder = getFolder(uid, report.responderName);
      const entry: RespondentReportEntry = {
        key: `${incidentId}/${kind}/${uid}`, kind, ownerUid: uid,
        respondent: folder.respondent, incidentId,
        patient: caseReport.emergency?.patientName || caseReport.emergency?.userName || "Patient not recorded",
        submittedAt: report.submittedAt, updatedAt: report.updatedAt,
        classification: kind === "final" ? final?.classification || "" : (report as IndividualRescueReport).classificationRecommendation,
        narrative: report, summary: kind === "final" ? final?.summary || "" : "",
        isNew: isNewRescueCase(caseReport), caseReport,
      };
      entries.push(entry); folder.reports.push(entry);
      folder.newCount += entry.isNew ? 1 : 0;
      folder.previousCount += entry.isNew ? 0 : 1;
      // Review activity must not rewrite the original submission order.
      folder.latestAt = Math.max(folder.latestAt, entry.submittedAt || entry.updatedAt);
    };
    for (const [uid, individual] of Object.entries(responders)) add(uid, "individual", individual);
    if (final) add(ownerUid || UNASSIGNED_REPORT_OWNER, "final", final);
  }
  const recentFirst = (a: RespondentReportEntry, b: RespondentReportEntry) =>
    (b.submittedAt || b.updatedAt) - (a.submittedAt || a.updatedAt) || a.key.localeCompare(b.key);
  entries.sort(recentFirst);
  for (const folder of folderMap.values()) folder.reports.sort(recentFirst);
  cases.sort((a, b) => {
    const latest = (item: RescueReportCase) => Math.max(item.final?.submittedAt || 0,
      ...Object.values(item.responders).map(report => report.submittedAt), item.emergency?.createdAt || 0);
    return latest(b) - latest(a);
  });
  const folders = [...folderMap.values()].sort((a, b) => b.latestAt - a.latestAt || a.respondent.name.localeCompare(b.respondent.name));
  return { cases, entries, folders };
}

export function reportMatches(entry: RespondentReportEntry, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = [entry.patient, entry.incidentId, entry.respondent.name, entry.kind,
    reportLabel(entry.classification), entry.summary, reportCaseStatus(entry.caseReport).label,
    ...Object.values(entry.narrative)].join(" ").toLowerCase();
  return terms.every(term => text.includes(term));
}

/** Detects changes to the submission or its administrative review before saving. */
export function finalReportRevision(value: unknown): string {
  const report = record(value);
  return JSON.stringify(["coordinatorUid", "classification", "summary", "submittedAt", "arrivalAt",
    "completedAt", "observedCondition", "actionsPerformed", "agenciesContacted", "transportDestination", "notes",
    "reviewStatus", "reviewedAt", "reviewedBy", "reviewNotes"]
    .map(key => report[key] ?? ""));
}
