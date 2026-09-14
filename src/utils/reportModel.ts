import type { ReportSource } from "../services/reportService";
import { todayInManila, validDate } from "../services/inhabitantModel";
export type ReportType = "complete" | "emergencies" | "rescue" | "heatmap" | "population" | "population-summary" | "monitoring" | "programs" | "residents" | "responders" | "directory" | "announcements" | "notifications" | "audit";
export interface ReportFilters {
  startDate: string; endDate: string; search: string;
  purok?: string; status?: string; priority?: string; program?: string; household?: string; member?: string; staff?: string;
  sex?: string; sector?: string; scope?: string; activityDate?: "scheduled" | "actual"; condition?: string; respondent?: string;
}
export interface ReportMetric { label: string; value: string | number; helper?: string; tone?: "primary" | "error" | "success" | "warning" | "neutral" }
export interface ReportColumn { key: string; label: string; align?: "left" | "center" | "right" }
export type ReportRow = Record<string, string | number>;
export interface ReportSection { id: string; title: string; description: string; columns: ReportColumn[]; rows: ReportRow[]; group: string }
export interface GeneratedReport {
  type: ReportType; title: string; description: string; generatedAt: number; referenceDate: string; periodLabel: string;
  filters: ReportFilters; filterLabels: string[]; metrics: ReportMetric[]; sections: ReportSection[]; totalRows: number; notes: string[];
}
export interface ReportDefinition { id: ReportType; title: string; shortTitle: string; group: string; description: string; sources: ReportSource[]; static?: boolean; dateNote: string }
const current = "Current masterlist. Dates do not reconstruct past records.";
export const REPORT_CATALOG: ReportDefinition[] = [
  { id:"complete",title:"Complete system report",shortTitle:"Complete system",group:"Overview",description:"Every reporting module in one organized document.",sources:[],dateNote:"Dates apply to activities. Masterlists show current records. All times use Philippine time." },
  { id:"emergencies",title:"SOS and emergency response",shortTitle:"SOS & response",group:"Emergency operations",description:"Critical SOS, Moderate SOS, response teams, updates and urgency reviews.",sources:["emergencies","users","responders","emergencyEvents","incidentAnalytics"],dateNote:"Incident tables use the SOS date. Update and urgency history use the action date." },
  { id:"rescue",title:"Rescue reports by respondent",shortTitle:"Rescue reports",group:"Emergency operations",description:"Respondent submissions, new and previous reports, outcomes and admin reviews.",sources:["rescueReports","rescueEntries","emergencies","responders","incidentAnalytics"],dateNote:"Submissions use their own submission date, including individual reports. Reviews use the review date." },
  { id:"heatmap",title:"Incident locations and heatmap summary",shortTitle:"Heatmap & locations",group:"Emergency operations",description:"Mapped incidents, Purok totals, urgency and location coverage.",sources:["incidentAnalytics","emergencies"],dateNote:"Uses the incident date and the same valid GPS records as Incident heatmap." },
  { id:"population",title:"Households and inhabitants",shortTitle:"Households & inhabitants",group:"Community records",description:"Household members, personal information, income, occupation and social profiles.",sources:["households","inhabitants"],static:true,dateNote:current },
  { id:"population-summary",title:"Population monitoring summary",shortTitle:"Population summary",group:"Community records",description:"Age brackets, sex, sectors, civil status, citizenship and family totals.",sources:["households","inhabitants"],static:true,dateNote:"Current active population. Age is calculated on the report date; sectors can overlap." },
  { id:"residents",title:"Resident accounts and medical profiles",shortTitle:"Resident accounts",group:"Community records",description:"App accounts and their saved medical profiles, kept separate from the inhabitants masterlist.",sources:["users","healthProfiles"],static:true,dateNote:current },
  { id:"monitoring",title:"Community monitoring and followups",shortTitle:"Monitoring & followups",group:"Programs and monitoring",description:"Individual and household cases, appointments, attendance, results and referrals.",sources:["monitoringCases","monitoringPrograms","households","inhabitants"],dateNote:"Cases use start date. Activities use the selected scheduled or actual date. Case completion uses completion date." },
  { id:"programs",title:"Barangay program results",shortTitle:"Program results",group:"Programs and monitoring",description:"Program catalog, recorded activities, people monitored and household reach.",sources:["monitoringCases","monitoringPrograms","households","inhabitants"],dateNote:"Results use the actual activity date. The catalog shows current program definitions, including archived programs." },
  { id:"responders",title:"Respondent authorization and availability",shortTitle:"Respondent authorization",group:"Administration",description:"Personnel, applications, review decisions and retained invitations.",sources:["responders","respondentApplications","respondentInvitations"],dateNote:"Applications use submission date and invitations use creation date. Personnel show current status." },
  { id:"directory",title:"Emergency contact directory",shortTitle:"Emergency directory",group:"Administration",description:"Barangay and national emergency contacts with availability and phone numbers.",sources:["directoryContacts","globalContacts"],static:true,dateNote:current },
  { id:"announcements",title:"Announcements report",shortTitle:"Announcements",group:"Administration",description:"Published, draft and archived notices with their full messages.",sources:["announcements"],dateNote:"Uses announcement creation date and current publication status." },
  { id:"notifications",title:"Notification request activity",shortTitle:"Notification requests",group:"Administration",description:"Queued notifications and processing status recorded by the system.",sources:["notifications","users"],dateNote:"Uses request creation date. Processing status does not prove device delivery or that a message was read." },
  { id:"audit",title:"Administrative activity and edit history",shortTitle:"Audit & edit history",group:"Administration",description:"Administrative actions, monitoring corrections and SOS urgency changes.",sources:["auditLogs","monitoringCases","emergencies","users","responders"],dateNote:"Uses each recorded action date. History contains only actions saved by the system." },
];
REPORT_CATALOG[0].sources = [...new Set(REPORT_CATALOG.slice(1).flatMap(d => d.sources))];
export const DEFAULT_REPORT_FILTERS: ReportFilters = {startDate:"",endDate:"",search:"",activityDate:"scheduled"};
export const label = (value: unknown, fallback = "Not recorded") => String(value ?? "").trim() || fallback;
export const titleCase = (value: unknown) => label(value).replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export function dateTime(value: unknown): string {
  const n=Number(value); return !Number.isFinite(n)||n<=0||!Number.isFinite(new Date(n).getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(n));
}
export function day(value: unknown): string {
  if (typeof value === "string" && validDate(value)) return value;
  const n=Number(value); if (!Number.isFinite(n)||n<=0||!Number.isFinite(new Date(n).getTime())) return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(n));
  return ["year","month","day"].map(t=>parts.find(p=>p.type===t)?.value).join("-");
}
export function dateOnly(value: unknown): string { const d=day(value); return d || "Not recorded"; }
export function validateFilters(f: ReportFilters) {
  if ((f.startDate&&!validDate(f.startDate)) || (f.endDate&&!validDate(f.endDate))) throw new Error("Enter valid start and end dates.");
  if(f.startDate&&f.endDate&&f.startDate>f.endDate) throw new Error("The end date must be on or after the start date.");
}
export function inPeriod(date: unknown,f: ReportFilters): boolean {
  if(!f.startDate&&!f.endDate)return true;
  const d=day(date);return Boolean(d&&(!f.startDate||d>=f.startDate)&&(!f.endDate||d<=f.endDate));
}
export function matchesSearch(values: unknown[],search: string): boolean {
  const text=values.join(" ").toLocaleLowerCase(); return search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(term=>text.includes(term));
}
export function matchesStatus(value: unknown,filter?: string): boolean { return !filter || label(value).toLowerCase()===filter.toLowerCase(); }
export function periodText(f:ReportFilters): string {return f.startDate&&f.endDate ? `${f.startDate} to ${f.endDate}` : f.startDate?`From ${f.startDate}`:f.endDate?`Through ${f.endDate}`:"All available dates";}
export function presetDates(preset:string,today=todayInManila()) {
  const y=Number(today.slice(0,4)),m=Number(today.slice(5,7));
  if(preset==="today")return {startDate:today,endDate:today};
  if(preset==="month")return {startDate:`${today.slice(0,7)}-01`,endDate:today};
  if(preset==="quarter")return {startDate:`${y}-${String(Math.floor((m-1)/3)*3+1).padStart(2,"0")}-01`,endDate:today};
  if(preset==="year")return {startDate:`${y}-01-01`,endDate:today};
  return {startDate:"",endDate:""};
}
export function columns(spec: Array<[string,string]>): ReportColumn[] {return spec.map(([key,label])=>({key,label}));}
