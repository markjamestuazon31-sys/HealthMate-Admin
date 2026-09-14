import { todayInManila, validDate } from "./inhabitantModel";

export const PROGRAM_SUGGESTIONS = ["TB monitoring", "Prenatal care", "Child nutrition", "Immunization", "Senior health", "Community attendance"];
export const CASE_STATUSES = ["Active", "Referred", "Completed"] as const;
export const ACTIVITY_STATUSES = ["Pending", "Done", "Referred", "Cancelled"] as const;
export const ATTENDANCE_OPTIONS = ["Present", "Absent", "Not applicable"] as const;
export type CaseStatus = typeof CASE_STATUSES[number];
export type ActivityStatus = typeof ACTIVITY_STATUSES[number];
export interface PersonSnapshot { householdId?: string; fullName: string; householdName: string; purok: string; address: string; birthDate: string; sex: string }
export interface MonitoringContext { scope?: "person" | "household"; participants?: Record<string, PersonSnapshot>; program: string; condition: string; assignedTo: string; person: PersonSnapshot }
export interface MonitoringActivity {
  id: string; scheduledDate: string; actualDate: string; activityType: string; status: ActivityStatus;
  attendance: string; observations: string; result: string; actionTaken: string; referredTo: string;
  referralReason: string; context: MonitoringContext; createdAt: number; createdBy: string; updatedAt: number; updatedBy: string;
}
export interface CaseDetails {
  programId?: string; program: string; condition: string; assignedTo: string; startDate: string; notes: string;
  status: CaseStatus; completedDate: string; closureNotes: string;
}
export interface ChangeEntry {
  id: string; action: string; at: number; by: string; actorName: string; reason: string;
  before: CaseDetails | MonitoringActivity | null; after: CaseDetails | MonitoringActivity;
  affectedActivityIds: string[];
}
export interface MonitoringCase extends CaseDetails {
  id: string; inhabitantId: string; scope?: "person" | "household"; householdId?: string; participants?: Record<string, PersonSnapshot>; person: PersonSnapshot; version: number;
  createdAt: number; createdBy: string; updatedAt: number; updatedBy: string;
  activities: Record<string, MonitoringActivity>; history: Record<string, ChangeEntry>;
}
export interface CaseInput extends CaseDetails { scope?: "person" | "household"; householdId?: string; participantIds?: string[]; inhabitantId: string; firstFollowupDate: string; reason: string; cancelPending: boolean }
export interface ActivityInput {
  id?: string; scheduledDate: string; actualDate: string; activityType: string; status: ActivityStatus;
  attendance: string; observations: string; result: string; actionTaken: string; referredTo: string;
  referralReason: string; nextFollowupDate: string; reason: string;
}
export interface MonitoringFilters { household?: string; member?: string; scope?: string; search: string; program: string; condition: string; purok: string; staff: string; status: string; from: string; to: string; dateBasis: "scheduled" | "actual"; sort: "due" | "newest" | "name" }
export interface ActivityRow { record: MonitoringCase; activity: MonitoringActivity }
export const DEFAULT_MONITORING_FILTERS: MonitoringFilters = { search: "", program: "", condition: "", purok: "", staff: "", status: "", from: "", to: "", dateBasis: "scheduled", sort: "due" };
const clean = (v: unknown) => String(v ?? "").trim();
export function blankCase(): CaseInput { return { inhabitantId: "", program: "", condition: "", assignedTo: "", startDate: todayInManila(), notes: "", status: "Active", completedDate: "", closureNotes: "", firstFollowupDate: todayInManila(), reason: "", cancelPending: false }; }
export function blankActivity(status: ActivityStatus = "Pending"): ActivityInput { return { scheduledDate: todayInManila(), actualDate: status === "Pending" ? "" : todayInManila(), activityType: "Followup visit", status, attendance: "Present", observations: "", result: "", actionTaken: "", referredTo: "", referralReason: "", nextFollowupDate: "", reason: "" }; }
export function details(c: CaseDetails): CaseDetails { return { ...(c.programId ? {programId:c.programId} : {}), program: c.program, condition: c.condition, assignedTo: c.assignedTo, startDate: c.startDate, notes: c.notes, status: c.status, completedDate: c.completedDate || "", closureNotes: c.closureNotes || "" }; }
export function context(c: MonitoringCase): MonitoringContext { return { scope: c.scope || "person", ...(c.participants ? {participants:c.participants} : {}), program: c.program, condition: c.condition, assignedTo: c.assignedTo, person: { ...c.person } }; }
export function activities(c: MonitoringCase): MonitoringActivity[] { return Object.values(c.activities || {}); }
export function activityRows(cases: MonitoringCase[]): ActivityRow[] { return cases.flatMap(record => activities(record).map(activity => ({ record, activity }))); }
export function pending(c: MonitoringCase): MonitoringActivity[] { return c.status === "Completed" ? [] : activities(c).filter(a => a.status === "Pending"); }
export function nextDue(c: MonitoringCase): string { return pending(c).map(a => a.scheduledDate).sort()[0] || ""; }
export function isRecorded(a: Pick<MonitoringActivity,"status">): boolean { return a.status === "Done" || a.status === "Referred"; }
export function wasMonitored(a: MonitoringActivity): boolean { return isRecorded(a) && a.attendance !== "Absent"; }
export function overdue(row: ActivityRow, today = todayInManila()): boolean { return row.record.status !== "Completed" && row.activity.status === "Pending" && row.activity.scheduledDate < today; }
export function dateLabel(date: string): string { if (!validDate(date)) return "Not recorded"; return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)); }
export function periodRange(period: string, today = todayInManila()): { from: string; to: string } {
  const year = Number(today.slice(0,4)), month = Number(today.slice(5,7));
  if (period === "month") return { from: `${today.slice(0,7)}-01`, to: new Date(Date.UTC(year,month,0)).toISOString().slice(0,10) };
  if (period === "quarter") { const first = Math.floor((month - 1) / 3) * 3; return { from: new Date(Date.UTC(year,first,1)).toISOString().slice(0,10), to: new Date(Date.UTC(year,first+3,0)).toISOString().slice(0,10) }; }
  return { from: "", to: "" };
}
export function within(date: string, f: Pick<MonitoringFilters,"from" | "to">): boolean { return (!f.from && !f.to) || Boolean(date && (!f.from || date >= f.from) && (!f.to || date <= f.to)); }
function matches(c: MonitoringContext, inhabitantId: string, id: string, f: MonitoringFilters): boolean {
  const haystack = [Object.values(c.participants || {}).map(p=>p.fullName).join(" "), c.person.fullName, inhabitantId, id, c.person.householdName, c.person.address, c.program, c.condition, c.assignedTo].join(" ").toLowerCase();
  return (!f.household || householdKey(c.person) === f.household) && (!f.member || inhabitantId === f.member || Boolean(c.participants?.[f.member])) && (!f.scope || (c.scope || "person") === f.scope) && f.search.toLowerCase().trim().split(/\s+/).filter(Boolean).every(term => haystack.includes(term)) && (!f.program || c.program === f.program) && (!f.condition || c.condition === f.condition) && (!f.purok || c.person.purok === f.purok) && (!f.staff || c.assignedTo === f.staff);
}
export function filterCases(cases: MonitoringCase[], f: MonitoringFilters): MonitoringCase[] {
  return cases.filter(c => matches(context(c),c.inhabitantId,c.id,f) && (!f.status || c.status === f.status) && within(c.startDate,f)).sort((a,b) => f.sort === "name" ? a.person.fullName.localeCompare(b.person.fullName) : f.sort === "newest" ? b.updatedAt-a.updatedAt : (nextDue(a)||"9999").localeCompare(nextDue(b)||"9999") || a.person.fullName.localeCompare(b.person.fullName));
}
export function filterActivities(cases: MonitoringCase[], f: MonitoringFilters, report = false, today = todayInManila()): ActivityRow[] {
  return activityRows(cases).filter(row => {
    const a = row.activity;
    if (report && !isRecorded(a)) return false;
    const status = f.status === "Overdue" ? overdue(row,today) : !f.status || a.status === f.status;
    return status && matches(report ? a.context : context(row.record),row.record.inhabitantId,row.record.id,f) && within(report || f.dateBasis === "actual" ? a.actualDate : a.scheduledDate,f);
  }).sort((a,b) => f.sort === "name" ? a.activity.context.person.fullName.localeCompare(b.activity.context.person.fullName) : report || f.sort === "newest" ? (b.activity.actualDate || b.activity.scheduledDate).localeCompare(a.activity.actualDate || a.activity.scheduledDate) || b.activity.updatedAt-a.activity.updatedAt : a.activity.scheduledDate.localeCompare(b.activity.scheduledDate) || a.record.person.fullName.localeCompare(b.record.person.fullName));
}
export function reportTotals(rows: ActivityRow[]) {
  return { visits: rows.length, people: new Set(rows.filter(r => wasMonitored(r.activity) && !isHouseholdCase(r.record)).map(r => r.record.inhabitantId)).size, households: new Set(rows.filter(r=>wasMonitored(r.activity)).map(r=>r.activity.context.person.householdId).filter(Boolean)).size, cases: new Set(rows.map(r=>r.record.id)).size, absent: rows.filter(r => r.activity.attendance === "Absent").length, referred: rows.filter(r => r.activity.status === "Referred").length };
}
export function reportGroups(rows: ActivityRow[]) {
  const groups = new Map<string, ActivityRow[]>();
  rows.forEach(row => { const name = row.activity.context.program; groups.set(name,[...(groups.get(name)||[]),row]); });
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([program,group])=>({program,...reportTotals(group)}));
}
export function validateCase(input: CaseInput, old?: MonitoringCase, today = todayInManila()) {
  if ((input.scope || "person") === "person" && !clean(input.inhabitantId)) throw new Error("Select an inhabitant from the masterlist.");
  if (input.scope === "household" && !clean(input.householdId)) throw new Error("Select a household from the masterlist.");
  if (old && (input.scope || "person") !== (old.scope || "person")) throw new Error("The monitoring scope cannot change after enrollment.");
  for (const [label,value] of [["program",input.program],["assigned staff name",input.assignedTo]] as const) if (!clean(value)) throw new Error(`Enter the ${label}.`);
  if (!CASE_STATUSES.includes(input.status)) throw new Error("Choose a valid case status.");
  if (!validDate(input.startDate)) throw new Error("Enter a valid start date.");
  if (!old && (!validDate(input.firstFollowupDate) || input.firstFollowupDate < input.startDate)) throw new Error("The first followup must be on or after the start date.");
  if (!old && input.status !== "Active") throw new Error("New monitoring cases must start as Active.");
  if (old) {
    if (input.inhabitantId !== old.inhabitantId) throw new Error("A monitoring case cannot be moved to another inhabitant.");
    if (!clean(input.reason)) throw new Error("Enter a reason for this correction or status change.");
    if (activities(old).some(a => a.scheduledDate < input.startDate || Boolean(a.actualDate && a.actualDate < input.startDate))) throw new Error("The start date cannot be after an existing activity date.");
  }
  if (input.status === "Completed") {
    if (!validDate(input.completedDate) || input.completedDate < input.startDate || input.completedDate > today) throw new Error("Enter a completion date between the start date and today.");
    if (!clean(input.closureNotes)) throw new Error("Enter the case completion result.");
    if (old && activities(old).some(a => isRecorded(a) && a.actualDate > input.completedDate)) throw new Error("Completion cannot be before the latest recorded activity.");
    if (old && pending(old).length && !input.cancelPending) throw new Error("Confirm cancellation of the remaining pending followups before completing the case.");
  }
  if ([input.program,input.condition,input.assignedTo].some(v => clean(v).length>160)) throw new Error("Program, condition and staff fields must be 160 characters or fewer.");
  if ([input.notes,input.closureNotes,input.reason].some(v => clean(v).length>4000)) throw new Error("Notes must be 4,000 characters or fewer.");
}
export function validateActivity(input: ActivityInput, record: MonitoringCase, today = todayInManila()) {
  if (record.status === "Completed") throw new Error("Reopen this case before scheduling or changing activities.");
  if (!ACTIVITY_STATUSES.includes(input.status)) throw new Error("Choose a valid activity status.");
  if (!validDate(input.scheduledDate) || input.scheduledDate < record.startDate) throw new Error("The scheduled date must be on or after the case start date.");
  if (!clean(input.activityType)) throw new Error("Enter the activity name.");
  if (input.id && !record.activities?.[input.id]) throw new Error("This activity no longer exists.");
  if (input.id && !clean(input.reason)) throw new Error("Enter a reason for updating this activity.");
  if (input.status === "Cancelled" && !clean(input.reason)) throw new Error("Enter a cancellation reason.");
  if (isRecorded(input)) {
    if (!validDate(input.actualDate) || input.actualDate < record.startDate || input.actualDate > today) throw new Error("Enter an actual activity date between the case start date and today.");
    if (!ATTENDANCE_OPTIONS.includes(input.attendance as typeof ATTENDANCE_OPTIONS[number])) throw new Error("Record attendance for this activity.");
    if (!clean(input.result) || !clean(input.actionTaken)) throw new Error("Enter the result and action taken.");
    if (input.status === "Referred" && (!clean(input.referredTo) || !clean(input.referralReason))) throw new Error("Enter the referral destination and reason.");
  }
  if (input.nextFollowupDate && (!isRecorded(input) || !validDate(input.nextFollowupDate) || input.nextFollowupDate <= input.actualDate)) throw new Error("The next followup must be after the actual activity date.");
  if (input.id && isRecorded(record.activities[input.id]) && input.nextFollowupDate) throw new Error("Use Schedule followup to add another appointment after correcting a recorded visit.");
  if (clean(input.activityType).length>160 || [input.observations,input.result,input.actionTaken,input.referralReason,input.reason].some(v=>clean(v).length>4000) || clean(input.referredTo).length>200) throw new Error("Use up to 160 characters for the activity, 200 for the referral destination and 4,000 for notes.");
}
export function cleanDetails(input: CaseInput): CaseDetails { return { ...(input.programId ? {programId:input.programId} : {}), program:clean(input.program),condition:clean(input.condition),assignedTo:clean(input.assignedTo),startDate:input.startDate,notes:clean(input.notes),status:input.status,completedDate:input.status==="Completed"?input.completedDate:"",closureNotes:input.status==="Completed"?clean(input.closureNotes):"" }; }
export function makeActivity(input: ActivityInput, record: MonitoringCase, id: string, uid: string, now: number): MonitoringActivity {
  const old=record.activities?.[id], recorded=input.status==="Done"||input.status==="Referred";
  return { id,scheduledDate:input.scheduledDate,actualDate:recorded?input.actualDate:"",activityType:clean(input.activityType),status:input.status,attendance:recorded?input.attendance:"Not recorded",observations:recorded?clean(input.observations):"",result:recorded?clean(input.result):"",actionTaken:recorded?clean(input.actionTaken):"",referredTo:input.status==="Referred"?clean(input.referredTo):"",referralReason:input.status==="Referred"?clean(input.referralReason):"",context:old && isRecorded(old)?old.context:context(record),createdAt:old?.createdAt||now,createdBy:old?.createdBy||uid,updatedAt:now,updatedBy:uid };
}

export function isHouseholdCase(record: Pick<MonitoringCase, "scope">): boolean { return record.scope === "household"; }
export function householdKey(person: PersonSnapshot): string { return person.householdId || (person.householdName ? `legacy:${person.householdName}` : ""); }
export function duplicateMonitoringCase(a: Pick<MonitoringCase,"inhabitantId"|"householdId"|"scope"|"program"|"programId">, b: Pick<MonitoringCase,"inhabitantId"|"householdId"|"scope"|"program"|"programId">): boolean {
  return (a.scope || "person") === (b.scope || "person") && (a.scope === "household" ? a.householdId === b.householdId : a.inhabitantId === b.inhabitantId) && ((Boolean(a.programId) && a.programId === b.programId) || a.program.trim().toLowerCase() === b.program.trim().toLowerCase());
}
