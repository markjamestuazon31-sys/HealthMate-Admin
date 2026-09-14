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
import type { SystemReportData } from "../services/reportService";

export type ReportType =
  | "complete"
  | "emergencies"
  | "rescue"
  | "residents"
  | "population"
  | "responders"
  | "directory"
  | "announcements"
  | "audit";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  search: string;
}

export interface ReportMetric {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "primary" | "error" | "success" | "warning" | "neutral";
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

export type ReportRow = Record<string, string | number>;

export interface ReportSection {
  id: string;
  title: string;
  description?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface GeneratedReport {
  type: ReportType;
  title: string;
  description: string;
  generatedAt: number;
  periodLabel: string;
  filters: ReportFilters;
  metrics: ReportMetric[];
  sections: ReportSection[];
  totalRows: number;
}

export const REPORT_CATALOG: Array<{
  id: ReportType;
  title: string;
  shortTitle: string;
  description: string;
}> = [
  {
    id: "complete",
    title: "Complete system report",
    shortTitle: "Complete system",
    description: "A consolidated printable record covering every major HealthMate administration module.",
  },
  {
    id: "emergencies",
    title: "Emergency incident report",
    shortTitle: "Emergencies",
    description: "Incident volume, patient, type, priority, status, service area, and resolution dates.",
  },
  {
    id: "rescue",
    title: "Rescue operations report",
    shortTitle: "Rescue operations",
    description: "Responder submissions, classifications, final reports, and administrator review status.",
  },
  {
    id: "residents",
    title: "Registered residents report",
    shortTitle: "Residents",
    description: "Resident accounts, contact details, location assignment, account status, and registration dates.",
  },
  {
    id: "population",
    title: "Household and inhabitant report",
    shortTitle: "Population",
    description: "Household registry and inhabitant profiling records for the barangay service area.",
  },
  {
    id: "responders",
    title: "Respondent authorization report",
    shortTitle: "Respondent authorization",
    description: "Applications, registered emergency personnel, availability, account status, and legacy invitation records.",
  },
  {
    id: "directory",
    title: "Emergency directory report",
    shortTitle: "Emergency directory",
    description: "Barangay emergency organizations, categories, contact numbers, addresses, and activation status.",
  },
  {
    id: "announcements",
    title: "Announcements activity report",
    shortTitle: "Announcements",
    description: "Published, draft, and archived public communication records with categories and dates.",
  },
  {
    id: "audit",
    title: "Administrator audit trail",
    shortTitle: "Audit trail",
    description: "Administrative actions, actors, related users or incidents, details, and timestamps.",
  },
];

const normalize = (value: unknown) => String(value ?? "").trim();
function titleCase(value: unknown, fallback = "—") {
  const text = normalize(value);
  if (!text) return fallback;
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value: unknown) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
  return new Date(timestamp).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateOnly(value: unknown) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "—";
  return new Date(timestamp).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function parseStart(date: string) {
  if (!date) return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(`${date}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function parseEnd(date: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(`${date}T23:59:59.999`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function validateRange(filters: ReportFilters) {
  const start = parseStart(filters.startDate);
  const end = parseEnd(filters.endDate);
  if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
    throw new Error("The report start date cannot be later than the end date.");
  }
}

function inRange(timestamp: unknown, filters: ReportFilters) {
  if (!filters.startDate && !filters.endDate) return true;
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return false;
  return value >= parseStart(filters.startDate) && value <= parseEnd(filters.endDate);
}

function hasSearch(values: unknown[], filters: ReportFilters) {
  const query = normalize(filters.search).toLowerCase();
  if (!query) return true;
  return values.some((value) => normalize(value).toLowerCase().includes(query));
}

function periodLabel(filters: ReportFilters) {
  if (!filters.startDate && !filters.endDate) return "All available records";
  if (filters.startDate && filters.endDate) return `${filters.startDate} to ${filters.endDate}`;
  if (filters.startDate) return `From ${filters.startDate}`;
  return `Through ${filters.endDate}`;
}

function isResident(user: User) {
  const role = normalize(user.role).toLowerCase();
  return !role || role === "user" || role === "resident";
}

function emergencyRows(data: Emergency[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.createdAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.patientName,
      item.patientPhone,
      item.type,
      item.priority,
      item.status,
      item.assignedBarangayId,
      item.locationSummary?.barangayName,
      item.locationSummary?.description,
    ], filters))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => ({
      incident: item.id,
      patient: item.patientName || item.userName || "Unknown user",
      type: item.type || "SOS Alert",
      priority: titleCase(item.priority),
      status: titleCase(item.status),
      area: item.locationSummary?.description || item.locationSummary?.barangayName || item.assignedBarangayId || "—",
      created: dateTime(item.createdAt),
      resolved: dateTime(item.closedAt || item.cancelledAt),
    }));
}

function rescueRows(data: RescueReportBundle[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.final?.submittedAt ?? item.emergency?.createdAt, filters))
    .filter((item) => hasSearch([
      item.incidentId,
      item.emergency?.patientName,
      item.final?.classification,
      item.final?.reviewStatus,
      item.final?.summary,
      ...Object.values(item.responders).map((entry) => entry.responderName),
    ], filters))
    .sort((a, b) => (b.final?.submittedAt ?? b.emergency?.createdAt ?? 0) - (a.final?.submittedAt ?? a.emergency?.createdAt ?? 0))
    .map((item) => ({
      incident: item.incidentId,
      patient: item.emergency?.patientName || "Unknown patient",
      classification: titleCase(item.final?.classification, "No final report"),
      review: titleCase(item.final?.reviewStatus, "Pending final report"),
      responders: Object.keys(item.responders).length,
      coordinator: item.final?.coordinatorUid || "—",
      submitted: dateTime(item.final?.submittedAt),
      reviewed: dateTime(item.final?.reviewedAt),
    }));
}

function residentRows(users: User[], filters: ReportFilters): ReportRow[] {
  return users
    .filter(isResident)
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.uid,
      item.fullName,
      item.email,
      item.phone,
      item.contactNumber,
      item.address,
      item.purokLabel,
      item.purokId,
      item.accountStatus,
      item.status,
    ], filters))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((item) => ({
      resident: item.fullName,
      email: item.email || "—",
      phone: item.phone || item.contactNumber || "—",
      purok: item.purokLabel || item.purokId || "—",
      address: item.address || "—",
      status: titleCase(item.accountStatus || item.status, "Active"),
      registered: dateOnly(item.createdAt),
    }));
}

function householdRows(households: Household[], filters: ReportFilters): ReportRow[] {
  return households
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.householdName,
      item.householdHeadName,
      item.purokId,
      item.address,
      item.primaryContact,
      item.status,
    ], filters))
    .sort((a, b) => a.purokId.localeCompare(b.purokId) || a.householdName.localeCompare(b.householdName))
    .map((item) => ({
      household: item.householdName,
      head: item.householdHeadName || "—",
      purok: item.purokId || "—",
      address: item.address || "—",
      contact: item.primaryContact || "—",
      members: item.memberCount ?? "—",
      status: titleCase(item.status),
      updated: dateOnly(item.updatedAt),
    }));
}

function inhabitantRows(inhabitants: Inhabitant[], filters: ReportFilters): ReportRow[] {
  return inhabitants
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.fullName,
      item.householdId,
      item.relationshipToHead,
      item.sex,
      item.civilStatus,
      item.phone,
      item.status,
    ], filters))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((item) => ({
      inhabitant: item.fullName,
      household: item.householdId || "—",
      relationship: item.relationshipToHead || "—",
      sex: item.sex || "—",
      civilStatus: item.civilStatus || "—",
      phone: item.phone || "—",
      status: titleCase(item.status),
      updated: dateOnly(item.updatedAt),
    }));
}

function responderRows(data: Responder[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.name,
      item.email,
      item.contact,
      item.position,
      item.availability,
      item.accountStatus,
      item.assignedBarangayId,
      item.serviceArea,
    ], filters))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      respondent: item.name,
      email: item.email || "—",
      contact: item.contact || "—",
      position: item.position || "Emergency Respondent",
      availability: titleCase(item.availability),
      status: titleCase(item.accountStatus),
      area: item.serviceArea || item.assignedBarangayId || "—",
      updated: dateOnly(item.updatedAt),
    }));
}

function applicationRows(data: RespondentApplication[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.submittedAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.applicantUid,
      item.fullName,
      item.email,
      item.phone,
      item.organization,
      item.requestedRole,
      item.status,
      item.assignedBarangayId,
      item.serviceArea,
    ], filters))
    .sort((a, b) => (b.updatedAt || b.submittedAt || 0) - (a.updatedAt || a.submittedAt || 0))
    .map((item) => ({
      applicant: item.fullName,
      email: item.email || "—",
      phone: item.phone || "—",
      organization: item.organization || "—",
      role: item.requestedRole || "Emergency Respondent",
      status: titleCase(item.status),
      area: item.serviceArea || item.assignedBarangayId || item.barangayId || "—",
      submitted: dateTime(item.submittedAt),
      reviewed: dateTime(item.reviewedAt),
    }));
}

function invitationRows(data: RespondentInvitation[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.fullName,
      item.normalizedEmail,
      item.phone,
      item.position,
      item.status,
      item.assignedBarangayId,
      item.serviceArea,
    ], filters))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => ({
      respondent: item.fullName,
      email: item.normalizedEmail || "—",
      phone: item.phone || "—",
      position: item.position || "Emergency Respondent",
      status: titleCase(item.status),
      area: item.serviceArea || item.assignedBarangayId || "—",
      registeredUid: item.registeredUid || "—",
      created: dateOnly(item.createdAt),
      updated: dateOnly(item.updatedAt),
    }));
}

function directoryRows(data: EmergencyDirectoryContact[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.createdAt ?? item.updatedAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.shortName,
      item.organizationName,
      item.category,
      item.phone,
      item.alternatePhone,
      item.email,
      item.address,
      item.active,
    ], filters))
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.shortName.localeCompare(b.shortName))
    .map((item) => ({
      shortName: item.shortName,
      organization: item.organizationName,
      category: titleCase(item.category),
      phone: item.phone || "—",
      alternate: item.alternatePhone || "—",
      email: item.email || "—",
      address: item.address || "—",
      status: item.active ? "Active" : "Inactive",
    }));
}

function announcementRows(data: Announcement[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.createdAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.title,
      item.category,
      item.status,
      item.content,
      item.createdBy,
    ], filters))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => ({
      title: item.title,
      category: item.category,
      status: titleCase(item.status),
      created: dateTime(item.createdAt),
      expires: dateTime(item.expiresAt),
      author: item.createdBy || "—",
    }));
}

function auditRows(data: AuditLog[], filters: ReportFilters): ReportRow[] {
  return data
    .filter((item) => inRange(item.timestamp ?? item.createdAt, filters))
    .filter((item) => hasSearch([
      item.id,
      item.action,
      item.performedBy,
      item.userId,
      item.incidentId,
      item.details,
    ], filters))
    .sort((a, b) => (b.timestamp ?? b.createdAt ?? 0) - (a.timestamp ?? a.createdAt ?? 0))
    .map((item) => ({
      action: item.action,
      actor: item.performedBy || "—",
      user: item.userId || "—",
      incident: item.incidentId || "—",
      details: item.details || "—",
      timestamp: dateTime(item.timestamp ?? item.createdAt),
    }));
}

const emergencyColumns: ReportColumn[] = [
  { key: "incident", label: "Incident ID" },
  { key: "patient", label: "Patient" },
  { key: "type", label: "Type" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "area", label: "Location / area" },
  { key: "created", label: "Created" },
  { key: "resolved", label: "Resolved" },
];

const rescueColumns: ReportColumn[] = [
  { key: "incident", label: "Incident ID" },
  { key: "patient", label: "Patient" },
  { key: "classification", label: "Classification" },
  { key: "review", label: "Review status" },
  { key: "responders", label: "Responders", align: "center" },
  { key: "coordinator", label: "Coordinator UID" },
  { key: "submitted", label: "Submitted" },
  { key: "reviewed", label: "Reviewed" },
];

const residentColumns: ReportColumn[] = [
  { key: "resident", label: "Resident" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "purok", label: "Purok" },
  { key: "address", label: "Address" },
  { key: "status", label: "Account status" },
  { key: "registered", label: "Registered" },
];

const householdColumns: ReportColumn[] = [
  { key: "household", label: "Household" },
  { key: "head", label: "Household head" },
  { key: "purok", label: "Purok" },
  { key: "address", label: "Address" },
  { key: "contact", label: "Primary contact" },
  { key: "members", label: "Members", align: "center" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Last updated" },
];

const inhabitantColumns: ReportColumn[] = [
  { key: "inhabitant", label: "Inhabitant" },
  { key: "household", label: "Household ID" },
  { key: "relationship", label: "Relationship" },
  { key: "sex", label: "Sex" },
  { key: "civilStatus", label: "Civil status" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Last updated" },
];

const responderColumns: ReportColumn[] = [
  { key: "respondent", label: "Respondent" },
  { key: "email", label: "Email" },
  { key: "contact", label: "Contact" },
  { key: "position", label: "Position" },
  { key: "availability", label: "Availability" },
  { key: "status", label: "Account status" },
  { key: "area", label: "Service area" },
  { key: "updated", label: "Last updated" },
];

const applicationColumns: ReportColumn[] = [
  { key: "applicant", label: "Applicant" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "organization", label: "Organization" },
  { key: "role", label: "Requested role" },
  { key: "status", label: "Application status" },
  { key: "area", label: "Service area" },
  { key: "submitted", label: "Submitted" },
  { key: "reviewed", label: "Reviewed" },
];

const invitationColumns: ReportColumn[] = [
  { key: "respondent", label: "Respondent" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "position", label: "Position" },
  { key: "status", label: "Invitation status" },
  { key: "area", label: "Service area" },
  { key: "registeredUid", label: "Registered UID" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
];

const directoryColumns: ReportColumn[] = [
  { key: "shortName", label: "Short name" },
  { key: "organization", label: "Organization" },
  { key: "category", label: "Category" },
  { key: "phone", label: "Primary phone" },
  { key: "alternate", label: "Alternate phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "status", label: "Status" },
];

const announcementColumns: ReportColumn[] = [
  { key: "title", label: "Announcement" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
  { key: "expires", label: "Expires" },
  { key: "author", label: "Created by" },
];

const auditColumns: ReportColumn[] = [
  { key: "action", label: "Action" },
  { key: "actor", label: "Performed by" },
  { key: "user", label: "User ID" },
  { key: "incident", label: "Incident ID" },
  { key: "details", label: "Details" },
  { key: "timestamp", label: "Timestamp" },
];

function buildSections(type: ReportType, data: SystemReportData, filters: ReportFilters): ReportSection[] {
  const sections: Record<Exclude<ReportType, "complete">, ReportSection[]> = {
    emergencies: [{
      id: "emergencies",
      title: "Emergency incidents",
      description: "All matching SOS and emergency incident records.",
      columns: emergencyColumns,
      rows: emergencyRows(data.emergencies, filters),
    }],
    rescue: [{
      id: "rescue",
      title: "Rescue operations",
      description: "Final and individual responder reporting grouped by incident.",
      columns: rescueColumns,
      rows: rescueRows(data.rescueReports, filters),
    }],
    residents: [{
      id: "residents",
      title: "Registered residents",
      description: "Normal HealthMate user/resident accounts only; respondent and applicant roles are excluded.",
      columns: residentColumns,
      rows: residentRows(data.users, filters),
    }],
    population: [
      {
        id: "households",
        title: "Households",
        description: "Barangay household registry.",
        columns: householdColumns,
        rows: householdRows(data.households, filters),
      },
      {
        id: "inhabitants",
        title: "Inhabitants",
        description: "Individual inhabitant profiling records.",
        columns: inhabitantColumns,
        rows: inhabitantRows(data.inhabitants, filters),
      },
    ],
    responders: [
      {
        id: "applications",
        title: "Respondent applications",
        description: "Mobile applications and current administrator review status.",
        columns: applicationColumns,
        rows: applicationRows(data.respondentApplications, filters),
      },
      {
        id: "responders",
        title: "Registered respondents",
        description: "Authorized emergency response personnel and current availability.",
        columns: responderColumns,
        rows: responderRows(data.responders, filters),
      },
      {
        id: "invitations",
        title: "Legacy invitation records",
        description: "Respondent invitation and legacy registration records retained by the system.",
        columns: invitationColumns,
        rows: invitationRows(data.respondentInvitations, filters),
      },
    ],
    directory: [{
      id: "directory",
      title: "Emergency directory",
      description: "Bunuanan emergency organizations and active contact information.",
      columns: directoryColumns,
      rows: directoryRows(data.directoryContacts, filters),
    }],
    announcements: [{
      id: "announcements",
      title: "Announcements",
      description: "Administrative public communications and publication status.",
      columns: announcementColumns,
      rows: announcementRows(data.announcements, filters),
    }],
    audit: [{
      id: "audit",
      title: "Administrator audit trail",
      description: "Recorded administrative actions from the audit log.",
      columns: auditColumns,
      rows: auditRows(data.auditLogs, filters),
    }],
  };

  if (type !== "complete") return sections[type];

  return [
    ...sections.emergencies,
    ...sections.rescue,
    ...sections.residents,
    ...sections.population,
    ...sections.responders,
    ...sections.directory,
    ...sections.announcements,
    ...sections.audit,
  ];
}

function buildMetrics(type: ReportType, sections: ReportSection[]): ReportMetric[] {
  const section = (id: string) => sections.find((item) => item.id === id)?.rows ?? [];
  const emergencies = section("emergencies");
  const rescue = section("rescue");
  const residents = section("residents");
  const households = section("households");
  const inhabitants = section("inhabitants");
  const applications = section("applications");
  const responders = section("responders");
  const invitations = section("invitations");
  const directory = section("directory");
  const announcements = section("announcements");
  const audit = section("audit");

  if (type === "emergencies") {
    const active = emergencies.filter((row) => !["Closed", "Cancelled"].includes(String(row.status))).length;
    const high = emergencies.filter((row) => ["High", "Critical"].includes(String(row.priority))).length;
    const closed = emergencies.filter((row) => String(row.status) === "Closed").length;
    return [
      { label: "Total incidents", value: emergencies.length, tone: "primary" },
      { label: "Active", value: active, tone: active ? "error" : "neutral" },
      { label: "High / critical", value: high, tone: high ? "warning" : "neutral" },
      { label: "Closed", value: closed, tone: "success" },
    ];
  }

  if (type === "rescue") {
    const finalReports = rescue.filter((row) => String(row.classification) !== "No final report").length;
    const approved = rescue.filter((row) => String(row.review) === "Approved").length;
    const pending = rescue.filter((row) => ["Pending Review", "Pending final report"].includes(String(row.review))).length;
    return [
      { label: "Rescue cases", value: rescue.length, tone: "primary" },
      { label: "Final reports", value: finalReports, tone: "neutral" },
      { label: "Approved", value: approved, tone: "success" },
      { label: "Pending review", value: pending, tone: pending ? "warning" : "neutral" },
    ];
  }

  if (type === "residents") {
    const active = residents.filter((row) => ["Active", "Approved"].includes(String(row.status))).length;
    const withPhone = residents.filter((row) => String(row.phone) !== "—").length;
    return [
      { label: "Residents", value: residents.length, tone: "primary" },
      { label: "Active accounts", value: active, tone: "success" },
      { label: "With contact number", value: withPhone, tone: "neutral" },
      { label: "Inactive / disabled", value: Math.max(0, residents.length - active), tone: "warning" },
    ];
  }

  if (type === "population") {
    const activeHouseholds = households.filter((row) => String(row.status) === "Active").length;
    const activeInhabitants = inhabitants.filter((row) => String(row.status) === "Active").length;
    return [
      { label: "Households", value: households.length, tone: "primary" },
      { label: "Active households", value: activeHouseholds, tone: "success" },
      { label: "Inhabitants", value: inhabitants.length, tone: "neutral" },
      { label: "Active inhabitants", value: activeInhabitants, tone: "success" },
    ];
  }

  if (type === "responders") {
    const active = responders.filter((row) => ["Active", "Approved"].includes(String(row.status))).length;
    const available = responders.filter((row) => String(row.availability) === "Available").length;
    const pendingApplications = applications.filter((row) => [
      "Pending Review",
      "Under Verification",
      "Additional Documents Required",
    ].includes(String(row.status))).length;
    return [
      { label: "Applications", value: applications.length, helper: `${pendingApplications} requiring review`, tone: pendingApplications ? "warning" : "neutral" },
      { label: "Registered respondents", value: responders.length, tone: "primary" },
      { label: "Active / available", value: `${active} / ${available}`, tone: "success" },
      { label: "Legacy invitations", value: invitations.length, tone: "neutral" },
    ];
  }

  if (type === "directory") {
    const active = directory.filter((row) => String(row.status) === "Active").length;
    const withAlternate = directory.filter((row) => String(row.alternate) !== "—").length;
    return [
      { label: "Directory contacts", value: directory.length, tone: "primary" },
      { label: "Active", value: active, tone: "success" },
      { label: "Inactive", value: Math.max(0, directory.length - active), tone: "warning" },
      { label: "With alternate phone", value: withAlternate, tone: "neutral" },
    ];
  }

  if (type === "announcements") {
    return [
      { label: "Announcements", value: announcements.length, tone: "primary" },
      { label: "Published", value: announcements.filter((row) => String(row.status) === "Published").length, tone: "success" },
      { label: "Draft", value: announcements.filter((row) => String(row.status) === "Draft").length, tone: "warning" },
      { label: "Archived", value: announcements.filter((row) => String(row.status) === "Archived").length, tone: "neutral" },
    ];
  }

  if (type === "audit") {
    const actors = new Set(audit.map((row) => String(row.actor)).filter((value) => value && value !== "—"));
    const incidents = new Set(audit.map((row) => String(row.incident)).filter((value) => value && value !== "—"));
    return [
      { label: "Audit entries", value: audit.length, tone: "primary" },
      { label: "Unique actors", value: actors.size, tone: "neutral" },
      { label: "Related incidents", value: incidents.size, tone: "warning" },
      { label: "Traceability", value: audit.length ? "Recorded" : "No entries", tone: audit.length ? "success" : "neutral" },
    ];
  }

  const activeEmergencies = emergencies.filter((row) => !["Closed", "Cancelled"].includes(String(row.status))).length;
  const approvedReports = rescue.filter((row) => String(row.review) === "Approved").length;
  const availableResponders = responders.filter((row) => String(row.availability) === "Available").length;

  return [
    { label: "Emergency incidents", value: emergencies.length, helper: `${activeEmergencies} active`, tone: activeEmergencies ? "error" : "primary" },
    { label: "Rescue reports", value: rescue.length, helper: `${approvedReports} approved`, tone: "primary" },
    { label: "Residents", value: residents.length, tone: "neutral" },
    { label: "Households / inhabitants", value: `${households.length} / ${inhabitants.length}`, tone: "neutral" },
    { label: "Respondent authorization", value: `${applications.length} / ${responders.length}`, helper: `applications / registered · ${availableResponders} available`, tone: "success" },
    { label: "Directory contacts", value: directory.length, tone: "neutral" },
    { label: "Announcements", value: announcements.length, tone: "neutral" },
    { label: "Audit entries", value: audit.length, tone: "neutral" },
  ];
}

export function buildGeneratedReport(
  type: ReportType,
  data: SystemReportData,
  filters: ReportFilters,
): GeneratedReport {
  validateRange(filters);
  const definition = REPORT_CATALOG.find((item) => item.id === type);
  if (!definition) throw new Error("Unknown report type.");

  const sections = buildSections(type, data, filters);
  const totalRows = sections.reduce((total, section) => total + section.rows.length, 0);

  return {
    type,
    title: definition.title,
    description: definition.description,
    generatedAt: Date.now(),
    periodLabel: periodLabel(filters),
    filters: { ...filters },
    metrics: buildMetrics(type, sections),
    sections,
    totalRows,
  };
}

function escapeCsv(value: unknown) {
  let text = normalize(value).replace(/\r?\n/g, " ");
  // Prevent spreadsheet applications from interpreting user-controlled text
  // as a formula when the CSV is opened in Excel/Sheets-compatible software.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadReportCsv(report: GeneratedReport) {
  const lines: string[] = [];
  lines.push(escapeCsv("HealthMate Administration Report"));
  lines.push(escapeCsv(report.title));
  lines.push(`${escapeCsv("Generated")},${escapeCsv(dateTime(report.generatedAt))}`);
  lines.push(`${escapeCsv("Period")},${escapeCsv(report.periodLabel)}`);
  if (report.filters.search) lines.push(`${escapeCsv("Search")},${escapeCsv(report.filters.search)}`);
  lines.push("");

  report.metrics.forEach((metric) => {
    lines.push(`${escapeCsv(metric.label)},${escapeCsv(metric.value)},${escapeCsv(metric.helper || "")}`);
  });

  report.sections.forEach((section) => {
    lines.push("");
    lines.push(escapeCsv(section.title));
    if (section.description) lines.push(escapeCsv(section.description));
    lines.push(section.columns.map((column) => escapeCsv(column.label)).join(","));
    section.rows.forEach((row) => {
      lines.push(section.columns.map((column) => escapeCsv(row[column.key] ?? "")).join(","));
    });
  });

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `healthmate-${report.type}-${new Date(report.generatedAt).toISOString().slice(0, 10)}.csv`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return normalize(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printMetric(metric: ReportMetric) {
  return `<div class="metric"><div class="metric-label">${escapeHtml(metric.label)}</div><div class="metric-value">${escapeHtml(metric.value)}</div>${metric.helper ? `<div class="metric-helper">${escapeHtml(metric.helper)}</div>` : ""}</div>`;
}

function printSection(section: ReportSection) {
  const header = section.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = section.rows.length
    ? section.rows.map((row) => `<tr>${section.columns.map((column) => `<td>${escapeHtml(row[column.key] ?? "")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${section.columns.length}" class="empty">No matching records.</td></tr>`;

  return `<section class="report-section">
    <div class="section-title">${escapeHtml(section.title)}</div>
    ${section.description ? `<div class="section-description">${escapeHtml(section.description)}</div>` : ""}
    <table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

/**
 * Opens a dedicated print document. From the browser print dialog the admin
 * can print to a physical printer or choose "Save as PDF" without requiring
 * a client-side PDF dependency.
 */
export function printGeneratedReport(report: GeneratedReport) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) {
    throw new Error("The browser blocked the print window. Allow pop-ups for the HealthMate admin portal and try again.");
  }

  try { printWindow.opener = null; } catch { /* Browser may disallow changing opener. */ }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #102A43; font-family: Inter, "Segoe UI", Arial, sans-serif; background: white; font-size: 10px; }
  .report-shell { width: 100%; }
  .brand { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 3px solid #D92D20; }
  .brand-name { color: #7A271A; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
  .brand-sub { margin-top: 3px; color: #647A99; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .report-code { color: #647A99; font-size: 9px; text-align: right; }
  h1 { margin: 18px 0 4px; color: #7A271A; font-size: 22px; line-height: 1.1; }
  .description { max-width: 900px; color: #647A99; font-size: 10.5px; line-height: 1.55; }
  .meta { display: flex; flex-wrap: wrap; gap: 12px 22px; padding: 12px 0 2px; color: #52667A; }
  .meta b { color: #7A271A; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0 18px; }
  .metric { min-height: 66px; padding: 10px 12px; border: 1px solid #F2D4D0; border-radius: 10px; background: #FFF8F7; }
  .metric-label { color: #647A99; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .55px; }
  .metric-value { margin-top: 5px; color: #B42318; font-size: 18px; font-weight: 900; }
  .metric-helper { margin-top: 2px; color: #647A99; font-size: 8.5px; }
  .report-section { margin-top: 18px; break-inside: auto; }
  .report-section + .report-section { page-break-before: auto; }
  .section-title { color: #7A271A; font-size: 14px; font-weight: 900; margin-bottom: 3px; }
  .section-title::after { content: ""; display: block; width: 42px; height: 2px; margin-top: 4px; background: #D92D20; border-radius: 999px; }
  .section-description { color: #647A99; margin-bottom: 8px; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: #7A271A; color: white; font-size: 8px; letter-spacing: .35px; text-transform: uppercase; padding: 6px 7px; border: 1px solid #7A271A; text-align: left; }
  td { padding: 6px 7px; border: 1px solid #DDE5EF; vertical-align: top; line-height: 1.35; word-break: break-word; }
  tbody tr:nth-child(even) td { background: #F8FAFC; }
  .empty { text-align: center; padding: 18px; color: #647A99; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #DDE5EF; color: #7A899D; font-size: 8.5px; line-height: 1.5; }
  @media print { .report-section { page-break-inside: auto; } }
</style>
</head>
<body>
<div class="report-shell">
  <div class="brand">
    <div>
      <div class="brand-name">HealthMate</div>
      <div class="brand-sub">Administration & Emergency Command Center</div>
    </div>
    <div class="report-code">System-generated administrative report<br/>Bunuanan Emergency Response System</div>
  </div>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="description">${escapeHtml(report.description)}</div>
  <div class="meta">
    <span><b>Generated:</b> ${escapeHtml(dateTime(report.generatedAt))}</span>
    <span><b>Reporting period:</b> ${escapeHtml(report.periodLabel)}</span>
    <span><b>Records:</b> ${escapeHtml(report.totalRows)}</span>
    ${report.filters.search ? `<span><b>Search filter:</b> ${escapeHtml(report.filters.search)}</span>` : ""}
  </div>
  <div class="metrics">${report.metrics.map(printMetric).join("")}</div>
  ${report.sections.map(printSection).join("")}
  <div class="footer">
    Generated from the live HealthMate administration data available to the signed-in administrator at the time shown above.
    Review sensitive information and follow applicable privacy, records-retention, and disclosure policies before distribution.
  </div>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });<\/script>
</body>
</html>`);
  printWindow.document.close();
}
