import type { SystemReportData } from "../services/reportService";
import type { Emergency } from "../types";
import { normalizeBunuananPurok, BUNUANAN_PUROKS } from "../config/bunuananServiceArea";
import { ageOn, currentInhabitants, familyCount, inSector, personLocation, populationSummary, socialLabels, todayInManila, type RegistryInhabitant } from "../services/inhabitantModel";
import { activities, context, isHouseholdCase, isRecorded, nextDue, overdue, wasMonitored, type MonitoringCase, type MonitoringContext } from "../services/monitoringModel";
import { programForName } from "../services/monitoringPrograms";
import { normalizeSosUrgency, reportedUrgencyLabel, sosUrgencyLabel } from "../services/sosUrgency";
import { columns, dateTime, inPeriod, label, matchesSearch, matchesStatus, titleCase, type ReportFilters, type ReportRow, type ReportSection, type ReportType } from "./reportModel";

const terminal=new Set(["CLOSED","CANCELLED","REPORT_SUBMITTED","ADMIN_REVIEWED","RESOLVED"]);
const active=(status:string)=>!terminal.has(status.toUpperCase());
const yes=(v:unknown)=>v===true?"Yes":v===false?"No":"Not recorded";
const money=(v:unknown)=>v!=null&&v!==""&&Number.isFinite(Number(v))?Number(v).toLocaleString("en-PH",{style:"currency",currency:"PHP"}):"Not recorded";
const purok=(v:unknown)=>normalizeBunuananPurok(v)||label(v,"Unassigned");
const section=(id:string,title:string,group:string,description:string,cols:Array<[string,string]>,rows:ReportRow[]):ReportSection=>({id,title,group,description,columns:columns(cols),rows});
const isResident=(role:unknown)=>["","user","resident"].includes(String(role??"").trim().toLowerCase());
export function buildReportSections(type:ReportType,d:SystemReportData,f:ReportFilters,referenceDate=todayInManila()):ReportSection[] {
  const result:ReportSection[]=[];
  const want=(group:ReportType)=>type==="complete"||type===group;
  const add=(...sections:ReportSection[])=>result.push(...sections);
  const hh=new Map(d.households.map(h=>[h.id,h]));
  const people=new Map(d.inhabitants.map(p=>[p.id,p]));
  const users=new Map(d.users.map(u=>[u.uid,u]));
  const names=new Map([...d.users.map(u=>[u.uid,u.fullName] as const),...d.responders.map(r=>[r.authUid||r.id,r.name] as const)]);
  const name=(id?:string)=>id?(names.get(id)||id):"Not recorded";
  const incidentById=new Map(d.emergencies.map(e=>[e.id,e]));
  const areaById=new Map(d.incidentAnalytics.map(e=>[e.id,purok(e.purokId)]));
  const incidentArea=(id:string)=>areaById.get(id)||"Unassigned";
  const incidentMatch=(e:Emergency,range=true)=> (!range||inPeriod(e.createdAt,f)) && (!f.purok||incidentArea(e.id)===f.purok)
    && (!f.priority||normalizeSosUrgency(e.priority)===f.priority) && matchesStatus(e.status,f.status)
    && matchesSearch([e.id,e.patientName,e.patientPhone,e.type,e.description,e.status,sosUrgencyLabel(e.priority),e.locationSummary.description,incidentArea(e.id)],f.search);
  const incidentList=d.emergencies.filter(e=>incidentMatch(e)).sort((a,b)=>b.createdAt-a.createdAt);

  if(want("emergencies")) {
    add(section("emergencies","Emergency incidents","SOS & response","One row per incident, selected by SOS date. Active response excludes completed response and review stages.",
      [["id","Incident ID"],["patient","Patient"],["type","Incident type"],["priority","Current urgency"],["reported","Resident selected"],["status","Status"],["purok","Purok"],["created","SOS received"],["resolved","Closed / cancelled"]],
      incidentList.map(e=>({id:e.id,patient:label(e.patientName||e.userName),type:label(e.type),priority:sosUrgencyLabel(e.priority),reported:reportedUrgencyLabel(e.reportedUrgency),status:titleCase(e.status),purok:incidentArea(e.id),created:dateTime(e.createdAt),resolved:dateTime(e.closedAt||e.cancelledAt),_active:active(e.status)?1:0}))),
    section("response-teams","Response team activity","SOS & response","Current recorded team state for incidents received in the selected period. Timing is not inferred when a timestamp is missing.",
      [["incident","Incident ID"],["respondent","Respondent"],["role","Team role"],["status","Response status"],["accepted","Accepted"],["updated","Updated"],["notes","Notes"]],
      incidentList.flatMap(e=>Object.values(e.responders||{}).filter(r=>!f.respondent||r.responderUid===f.respondent).map(r=>({incident:e.id,respondent:label(r.responderName||name(r.responderUid)),role:titleCase(r.teamRole),status:titleCase(r.responseStatus),accepted:dateTime(r.acceptedAt),updated:dateTime(r.updatedAt),notes:label(r.notes)})))),
    section("admin-response","Administrative response","SOS & response","Acknowledgement, verified arrival and closure details for the selected incidents.",
      [["incident","Incident ID"],["acknowledged","Acknowledged"],["by","Acknowledged by"],["arrival","Verified arrival"],["notes","Response notes"],["cancel","Cancellation reason"]],
      incidentList.map(e=>({incident:e.id,acknowledged:dateTime(e.adminAcknowledgedAt),by:label(e.adminAcknowledgedName||name(e.adminAcknowledgedBy)),arrival:e.arrivalVerified?dateTime(e.arrivalVerifiedAt):"Not verified",notes:label(e.responseNotes),cancel:label(e.cancellationReason)}))),
    section("emergency-events","Incident updates","SOS & response","Saved incident events, selected by action date. Includes events for older incidents when updated during this period.",
      [["incident","Incident ID"],["action","Action"],["status","Status"],["actor","Recorded by"],["message","Message / note"],["at","Action date"]],
      d.emergencyEvents.filter(v=>inPeriod(v.at,f)&&(!f.purok||incidentArea(v.incidentId)===f.purok)&&(!f.priority||incidentById.get(v.incidentId)?.priority===f.priority)&&matchesStatus(v.status,f.status)&&matchesSearch([v.incidentId,v.action,v.actor,v.message,v.note],f.search)).sort((a,b)=>b.at-a.at).map(v=>({incident:v.incidentId,action:titleCase(v.action),status:titleCase(v.status),actor:name(v.actor),message:[v.message,v.note].filter(Boolean).join("\n"),at:dateTime(v.at)}))));
  }
  if(want("emergencies")||want("audit")) {
    add(section("urgency-history","SOS urgency reviews",type==="audit"?"Audit & edit history":"SOS & response","Original and revised urgency, review reason and reviewer. Selected by review date.",
      [["incident","Incident ID"],["previous","Previous urgency"],["current","Revised urgency"],["reason","Reason"],["actor","Reviewed by"],["at","Reviewed"]],
      d.emergencies.flatMap(e=>Object.values(e.urgencyHistory||{}).filter(h=>inPeriod(h.at,f)&&(!f.purok||incidentArea(e.id)===f.purok)&&(!f.priority||normalizeSosUrgency(h.current)===f.priority)&&matchesSearch([e.id,e.patientName,h.reason,name(h.actorUid),sosUrgencyLabel(h.current)],f.search)).map(h=>({incident:e.id,previous:sosUrgencyLabel(h.previous),current:sosUrgencyLabel(h.current),reason:label(h.reason),actor:name(h.actorUid),at:dateTime(h.at),_at:h.at}))).sort((a,b)=>Number(b._at)-Number(a._at))));
  }
  if(want("rescue")) {
    const entries=d.rescueEntries.filter(e=>inPeriod(e.submittedAt,f)&&(!f.respondent||e.ownerUid===f.respondent)&&(!f.status||(f.status==="New"?e.isNew:!e.isNew))&&(!f.purok||incidentArea(e.incidentId)===f.purok)&&matchesSearch([e.incidentId,e.patient,e.respondent.name,e.classification,e.summary,e.narrative.observedCondition,e.narrative.actionsPerformed],f.search)).sort((a,b)=>a.respondent.name.localeCompare(b.respondent.name)||b.submittedAt-a.submittedAt);
    const owners=[...new Set(entries.map(e=>e.ownerUid))];
    add(section("rescue-folders","Respondent report folders","Rescue reports","Counts of individual and final submissions in this period. New and previous match the Rescue reports workspace.",
      [["respondent","Respondent"],["uid","Respondent ID"],["new","New"],["previous","Previous"],["individual","Individual reports"],["final","Final reports"],["latest","Latest submission"]],
      owners.map(uid=>{const reports=entries.filter(e=>e.ownerUid===uid);return{respondent:reports[0].respondent.name,uid,new:reports.filter(e=>e.isNew).length,previous:reports.filter(e=>!e.isNew).length,individual:reports.filter(e=>e.kind==="individual").length,final:reports.filter(e=>e.kind==="final").length,latest:dateTime(Math.max(...reports.map(e=>e.submittedAt)))};})),
    section("rescue-submissions","Respondent submissions","Rescue reports","Each submitted report is listed separately. Individual reports use their own submission dates even without a final report.",
      [["incident","Incident ID"],["respondent","Respondent"],["patient","Patient"],["kind","Report type"],["classification","Classification"],["group","Report group"],["submitted","Submitted"]],
      entries.map(e=>({incident:e.incidentId,respondent:e.respondent.name,patient:e.patient,kind:e.kind==="individual"?"Individual":"Coordinator final",classification:titleCase(e.classification),group:e.isNew?"New":"Previous",submitted:dateTime(e.submittedAt)}))),
    section("rescue-outcomes","Actions and outcomes","Rescue reports","Full report narratives corresponding to the selected submissions.",
      [["incident","Incident ID"],["respondent","Respondent / type"],["times","Arrival / completed"],["condition","Observed condition"],["actions","Actions performed"],["destination","Agencies / destination"],["summary","Summary / notes"]],
      entries.map(e=>({incident:e.incidentId,respondent:`${e.respondent.name}\n${e.kind}`,times:`Arrival: ${dateTime(e.narrative.arrivalAt)}\nCompleted: ${dateTime(e.narrative.completedAt)}`,condition:label(e.narrative.observedCondition),actions:label(e.narrative.actionsPerformed),destination:[e.narrative.agenciesContacted,e.narrative.transportDestination].filter(Boolean).join("\n")||"Not recorded",summary:[e.summary,e.narrative.notes].filter(Boolean).join("\n")||"Not recorded"}))),
    section("rescue-reviews","Final report decisions","Rescue reports","Reviewed final reports selected by review date. Unreviewed finals use submission date.",
      [["incident","Incident ID"],["coordinator","Coordinator"],["classification","Classification"],["review","Review status"],["reviewer","Reviewed by"],["notes","Review notes"],["reviewed","Review / submission date"]],
      d.rescueReports.filter(b=>b.final&&inPeriod(b.final.reviewedAt||b.final.submittedAt,f)&&(!f.respondent||b.final.coordinatorUid===f.respondent)&&(!f.purok||incidentArea(b.incidentId)===f.purok)&&(!f.status||d.rescueEntries.some(e=>e.incidentId===b.incidentId&&e.kind==="final"&&(f.status==="New"?e.isNew:!e.isNew)))&&matchesSearch([b.incidentId,b.final.summary,b.final.reviewStatus,name(b.final.coordinatorUid)],f.search)).map(b=>({incident:b.incidentId,coordinator:name(b.final!.coordinatorUid),classification:titleCase(b.final!.classification),review:titleCase(b.final!.reviewStatus),reviewer:name(b.final!.reviewedBy),notes:label(b.final!.reviewNotes),reviewed:dateTime(b.final!.reviewedAt||b.final!.submittedAt)}))));
  }
  if(want("heatmap")) {
    const mapped=d.incidentAnalytics.filter(e=>inPeriod(e.createdAt,f)&&(!f.purok||purok(e.purokId)===f.purok)&&(!f.priority||normalizeSosUrgency(e.priority)===f.priority)&&matchesStatus(e.status,f.status)&&matchesSearch([e.id,e.purokId,e.type,e.status,sosUrgencyLabel(e.priority)],f.search));
    const areas=[...new Set([...BUNUANAN_PUROKS,"Unassigned",...mapped.map(e=>purok(e.purokId))])].filter(p=>!f.purok||p===f.purok);
    add(section("heatmap-summary","Incidents by Purok","Heatmap & locations","One incident per map record. Density counts are separate from SOS urgency; current urgency and status match Incident heatmap.",
      [["purok","Purok"],["total","Mapped incidents"],["critical","Critical SOS"],["moderate","Moderate SOS"],["other","Other urgency"],["active","Active response"]],
      areas.map(p=>{const items=mapped.filter(e=>purok(e.purokId)===p);return {purok:p,total:items.length,critical:items.filter(e=>e.priority==="CRITICAL").length,moderate:items.filter(e=>e.priority==="MEDIUM").length,other:items.filter(e=>!["CRITICAL","MEDIUM"].includes(e.priority)).length,active:items.filter(e=>active(e.status)).length};})),
    section("heatmap-incidents","Mapped incident register","Heatmap & locations","Valid GPS incidents from the existing heatmap source. This report is a location register, not a new density calculation.",
      [["id","Incident ID"],["purok","Purok"],["verification","Purok verification"],["priority","Urgency"],["status","Status"],["gps","Latitude / longitude"],["created","Incident date"]],
      mapped.map(e=>({id:e.id,purok:purok(e.purokId),verification:titleCase(e.purokVerificationStatus),priority:sosUrgencyLabel(e.priority),status:titleCase(e.status),gps:`${e.latitude}, ${e.longitude}`,created:dateTime(e.createdAt)}))),
    section("unmapped-incidents","Incidents absent from the heatmap","Heatmap & locations","Incidents with no eligible analytics point. The source may be missing, outside Bunuanan or have invalid GPS. No location is invented.",
      [["id","Incident ID"],["patient","Patient"],["priority","Urgency"],["status","Status"],["area","Saved location description"],["created","Incident date"]],
      incidentList.filter(e=>!areaById.has(e.id)).map(e=>({id:e.id,patient:label(e.patientName),priority:sosUrgencyLabel(e.priority),status:titleCase(e.status),area:label(e.locationSummary.description),created:dateTime(e.createdAt)}))));
  }
  if(want("population")||want("population-summary")) {
    const matchPerson=(p:RegistryInhabitant)=>{
      const location=personLocation(p,hh.get(p.householdId));
      return (!f.household||p.householdId===f.household)&&(!f.member||p.id===f.member)&&(!f.purok||purok(location.purokId)===f.purok)&&matchesStatus(p.status,f.status)&&(!f.sex||label(p.sex).toLowerCase()===f.sex)&&(!f.sector||inSector(p,f.sector,referenceDate))&&matchesSearch([p.id,p.fullName,p.phone,p.occupation,p.relationshipToHead,hh.get(p.householdId)?.householdName,location.address,location.purokId,p.medicalConditions],f.search);
    };
    const members=d.inhabitants.filter(matchPerson).sort((a,b)=>a.fullName.localeCompare(b.fullName));
    if(want("population")) {
      const households=d.households.filter(h=>(!f.household||h.id===f.household)&&(!f.purok||purok(h.purokId)===f.purok)&&matchesStatus(h.status,f.status)&&(!f.member||people.get(f.member)?.householdId===h.id)&&(!(f.sex||f.sector)||members.some(p=>p.householdId===h.id))&&(matchesSearch([h.id,h.householdName,h.householdHeadName,h.purokId,h.address,h.primaryContact],f.search)||members.some(p=>p.householdId===h.id)));
      add(section("households","Household directory","Households & inhabitants","Current households. Member totals are counted from the inhabitant records, not a cached household total.",
        [["id","Household ID"],["household","Household / head"],["location","Purok / address"],["contact","Contact"],["members","Members / active"],["families","Recorded families"],["status","Status"]],
        households.map(h=>{const list=d.inhabitants.filter(p=>p.householdId===h.id);return{id:h.id,household:`${h.householdName}\nHead: ${label(h.householdHeadName||list.find(p=>p.isHouseholdHead)?.fullName)}`,location:`${purok(h.purokId)}\n${label(h.address)}`,contact:label(h.primaryContact),members:`${list.length} / ${list.filter(p=>p.status==="active").length}`,families:familyCount(list.filter(p=>p.status==="active")),status:titleCase(h.status)};})),
      section("household-living","Household living information","Households & inhabitants","Recorded housing and income information. Blank income is not treated as zero.",
        [["id","Household ID"],["household","Household"],["type","Household type"],["tenure","Tenure / unit"],["income","Monthly household income"],["landmark","Landmark"],["updated","Last updated"]],
        households.map(h=>({id:h.id,household:h.householdName,type:label(h.householdType),tenure:[h.tenureStatus,h.unitNumber].filter(Boolean).join(" / ")||"Not recorded",income:money(h.monthlyIncome),landmark:label(h.landmark),updated:dateTime(h.updatedAt)}))),
      section("inhabitants","Inhabitant masterlist","Households & inhabitants",`Current personal records. Ages calculated on ${referenceDate}. App account linking is not part of this masterlist.`,
        [["id","Inhabitant ID"],["person","Name / birthday / age"],["sex","Sex / civil status"],["household","Household / family"],["relationship","Relationship"],["location","Address / contact"],["status","Status"]],
        members.map(p=>{const h=hh.get(p.householdId),loc=personLocation(p,h);return{id:p.id,person:`${p.fullName}\nBirthday: ${label(p.birthDate)}\nAge: ${ageOn(p.birthDate,referenceDate)??"Not recorded"}`,sex:`${label(p.sex)} / ${label(p.civilStatus)}`,household:`${label(h?.householdName,p.householdId||"Unassigned")}\nFamily: ${p.familyNumber??"Not recorded"}`,relationship:label(p.relationshipToHead),location:`${purok(loc.purokId)} • ${label(loc.address)}\n${label(p.phone)}`,status:titleCase(p.status)};})),
      section("inhabitant-social","Health and social categories","Households & inhabitants","Yes, No and Not recorded remain distinct. Senior status is calculated from birthday.",
        [["id","Inhabitant ID"],["person","Inhabitant"],["categories","Recorded sectors"],["pwd","PWD / pregnant / 4Ps"],["other","OFW / solo parent / IP"],["health","Medical conditions / emergency notes"]],
        members.map(p=>({id:p.id,person:p.fullName,categories:socialLabels(p,referenceDate).join(", ")||"No recorded category",pwd:`PWD: ${yes(p.isPwd)}\nPregnant: ${yes(p.isPregnant)}\n4Ps: ${yes(p.is4Ps)}`,other:`OFW: ${yes(p.isOfw)}\nSolo parent: ${yes(p.isSoloParent)}\nIP: ${yes(p.isIndigenous)}`,health:`Conditions: ${label(p.medicalConditions)}\nHistory: ${label(p.medicalHistory)}\nPast treatments: ${label(p.pastTreatments)}\nEmergency notes: ${label(p.emergencyNotes)}`}))),
      section("inhabitant-livelihood","Education, livelihood and citizenship","Households & inhabitants","Employment, schooling, income and citizenship as entered in the masterlist.",
        [["id","Inhabitant ID"],["person","Inhabitant"],["occupation","Occupation / employment"],["school","School attendance"],["income","Monthly individual income"],["citizenship","Citizenship / nationality"],["notes","Profile notes"]],
        members.map(p=>({id:p.id,person:p.fullName,occupation:`${label(p.occupation)}\n${label(p.employmentStatus)}`,school:label(p.schoolAttendance),income:money(p.monthlyIncome),citizenship:`${label(p.citizenship)} / ${label(p.nationality)}`,notes:label(p.profileNotes)}))));
    }
    if(want("population-summary")) {
      const currentPeople=currentInhabitants(members,d.households),summary=populationSummary(currentPeople,referenceDate);
      const activeHouseholds=d.households.filter(h=>h.status==="active"&&(!f.purok||purok(h.purokId)===f.purok)&&(!f.household||h.id===f.household)&&(!(f.member||f.search||f.sex||f.sector)||currentPeople.some(p=>p.householdId===h.id)));
      add(section("population-totals","Population totals","Population summary",`Current active records, age on ${referenceDate}. Family counts require a recorded family number within a household.`,[["indicator","Indicator"],["total","Total"]],
        [{indicator:"Current inhabitants",total:currentPeople.length},{indicator:"Active households",total:activeHouseholds.length},{indicator:"Recorded families",total:familyCount(currentPeople)},{indicator:"Family number not recorded",total:currentPeople.filter(p=>!p.familyNumber).length}]));
      for(const [key,title,rows] of [["ages","Population by age bracket",summary.ages],["sectors","Population by sector",summary.sectors],["civil","Civil status",summary.civil],["citizenship","Citizenship",summary.citizenship]] as const) {
        add(section(`population-${key}`,title,"Population summary",key==="sectors"?"An inhabitant may belong to several sectors; sector totals must not be added as a population total.":"Unknown or other values are retained so totals reconcile with the masterlist.",[["indicator","Indicator"],["male","Male"],["female","Female"],["other","Other / not recorded"],["total","Total"]],rows.map(r=>({indicator:r.label,male:r.male,female:r.female,other:r.other,total:r.total}))));
      }
    }
  }
  function monitoringMatch(c:MonitoringCase,ctx:MonitoringContext) {
    const householdId=ctx.person.householdId || c.householdId || "";
    const programId=programForName(d.monitoringPrograms,ctx.program)?.id;
    return (!f.household||householdId===f.household)&&(!f.member||c.inhabitantId===f.member||Boolean(ctx.participants?.[f.member]))&&(!f.scope||(ctx.scope||"person")===f.scope)
      &&(!f.program||programId===f.program||ctx.program===f.program)&&(!f.staff||ctx.assignedTo===f.staff)&&(!f.condition||ctx.condition===f.condition)
      &&(!f.purok||purok(ctx.person.purok)===f.purok)&&matchesSearch([c.id,ctx.person.fullName,ctx.person.householdName,householdId,ctx.program,ctx.condition,ctx.assignedTo,...Object.values(ctx.participants||{}).map(p=>p.fullName)],f.search);
  }
  if(want("monitoring")||want("programs")||want("audit")) {
    const allMatching=d.monitoringCases.filter(c=>monitoringMatch(c,context(c)));
    const cases=allMatching.filter(c=>inPeriod(c.startDate,f));
    const rows=d.monitoringCases.flatMap(c=>activities(c).map(a=>({c,a,ctx:isRecorded(a)?a.context:context(c)}))).filter(({c,ctx})=>monitoringMatch(c,ctx));
    const visits=rows.filter(({a})=>isRecorded(a)&&inPeriod(a.actualDate,f));
    const appointments=rows.filter(({c,a})=>inPeriod(f.activityDate==="actual"?a.actualDate:a.scheduledDate,f)&&(f.status==="Overdue"?overdue({record:c,activity:a},referenceDate):matchesStatus(a.status,f.status)));
    if(want("monitoring")) {
      add(section("monitoring-cases","Monitoring case register","Monitoring & followups","Cases that started in the selected period. Activity status filters apply to the activity tables below.",
        [["id","Case ID"],["person","Person / household"],["scope","Scope / covered members"],["program","Program / condition"],["staff","Assigned staff"],["status","Case status"],["dates","Start / next followup"],["notes","Case notes"]],
        cases.map(c=>({id:c.id,person:`${c.person.fullName}\n${c.person.householdName}`,scope:`${isHouseholdCase(c)?"Household":"Individual"}${isHouseholdCase(c)?`\n${Object.values(c.participants||{}).map(p=>p.fullName).join(", ")}`:""}`,program:`${c.program}\n${label(c.condition)}`,staff:c.assignedTo,status:c.status,dates:`Started: ${c.startDate}\nNext: ${label(nextDue(c),"None scheduled")}`,notes:label(c.notes)}))),
      section("monitoring-activities","Appointments and recorded activities","Monitoring & followups",`Dates filtered by ${f.activityDate==="actual"?"actual activity":"scheduled followup"} date. An absent person is not counted as monitored. Household attendance applies to the household activity.`,
        [["case","Case ID"],["subject","Person / household"],["program","Program / condition"],["activity","Activity / staff"],["dates","Scheduled / actual"],["status","Status / attendance"],["result","Observations / result / action"]],
        appointments.map(({c,a,ctx})=>({case:c.id,subject:`${ctx.person.fullName}\n${ctx.person.householdName}${ctx.scope==="household"?`\nCovered: ${Object.values(ctx.participants||{}).map(p=>p.fullName).join(", ")}`:""}`,program:`${ctx.program}\n${label(ctx.condition)}`,activity:`${a.activityType}\n${ctx.assignedTo}`,dates:`Scheduled: ${a.scheduledDate}\nActual: ${label(a.actualDate)}`,status:`${a.status}${overdue({record:c,activity:a},referenceDate)?" • Overdue":""}\nAttendance: ${isRecorded(a)?label(a.attendance):"Not recorded"}`,result:[a.observations,a.result,a.actionTaken].filter(Boolean).join("\n")||"Not recorded",_status:a.status,_overdue:overdue({record:c,activity:a},referenceDate)?1:0,_person:!isHouseholdCase(c)&&wasMonitored(a)?c.inhabitantId:"",_household:wasMonitored(a)?ctx.person.householdId||"":""}))),
      section("monitoring-referrals","Referral details","Monitoring & followups","Referrals matching the selected activity date and filters.",
        [["case","Case ID"],["subject","Person / household"],["program","Program"],["destination","Referred to"],["reason","Reason"],["result","Result / action"],["date","Actual date"]],
        appointments.filter(({a})=>a.status==="Referred").map(({c,a,ctx})=>({case:c.id,subject:ctx.person.fullName,program:ctx.program,destination:label(a.referredTo),reason:label(a.referralReason),result:[a.result,a.actionTaken].filter(Boolean).join("\n"),date:label(a.actualDate)}))),
      section("monitoring-completed","Completed monitoring cases","Monitoring & followups","Selected by completion date, even when a case started before the reporting period.",
        [["id","Case ID"],["subject","Person / household"],["program","Program"],["staff","Assigned staff"],["completed","Completed"],["result","Completion result"]],
        allMatching.filter(c=>c.status==="Completed"&&inPeriod(c.completedDate,f)).map(c=>({id:c.id,subject:c.person.fullName,program:c.program,staff:c.assignedTo,completed:c.completedDate,result:label(c.closureNotes)}))));
    }
    if(want("programs")) {
      const groups=[...new Set(visits.map(r=>r.a.context.program))].sort();
      add(section("program-results","Program activity results","Program results","Recorded Done and Referred activities by actual date. Historical program names are retained. Unique people exclude absent visits and household activities; household reach requires a saved household ID.",
        [["program","Program"],["visits","Recorded activities"],["people","People monitored"],["households","Households reached"],["absent","Absent activities"],["referred","Referrals"],["cases","Cases with activity"]],
        groups.map(program=>{const list=visits.filter(r=>r.a.context.program===program);return{program,visits:list.length,people:new Set(list.filter(r=>wasMonitored(r.a)&&!isHouseholdCase(r.c)&&r.c.inhabitantId).map(r=>r.c.inhabitantId)).size,households:new Set(list.filter(r=>wasMonitored(r.a)&&r.ctx.person.householdId).map(r=>r.ctx.person.householdId)).size,absent:list.filter(r=>r.a.attendance==="Absent").length,referred:list.filter(r=>r.a.status==="Referred").length,cases:new Set(list.map(r=>r.c.id)).size};})),
      section("program-activity-detail","Program activity register","Program results","Underlying activities for program results. A person can appear in several programs; do not add program subtotals to obtain unique people.",
        [["case","Case ID"],["subject","Person / household"],["program","Recorded program"],["staff","Staff"],["status","Activity / attendance"],["date","Actual date"],["result","Result / action"]],
        visits.map(({c,a,ctx})=>({case:c.id,subject:ctx.person.fullName,program:ctx.program,staff:ctx.assignedTo,status:`${a.status} / ${a.attendance}`,date:a.actualDate,result:[a.result,a.actionTaken].filter(Boolean).join("\n"),_person:wasMonitored(a)&&!isHouseholdCase(c)?c.inhabitantId:"",_household:wasMonitored(a)?ctx.person.householdId||"":""}))),
      section("program-catalog","Current program catalog","Program results","Built in templates and locally configured programs. A catalog entry does not establish that a service was conducted. Availability is the enrollment setting.",
        [["id","Program ID"],["program","Program name"],["category","Category"],["scope","Enrollment scope"],["status","Availability"],["aliases","Previous names"],["updated","Last updated"]],
        d.monitoringPrograms.filter(p=>(!f.program||p.id===f.program||p.name===f.program)&&matchesSearch([p.name,p.category,...p.aliases||[]],f.search)).map(p=>({id:p.id,program:p.name,category:p.category,scope:p.scope==="person"?"Individual":p.scope==="household"?"Household":"Individual or household",status:titleCase(p.status),aliases:p.aliases?.join(", ")||"None",updated:p.updatedAt?dateTime(p.updatedAt):"Built in template"}))));
    }
    if(want("audit")) {
      add(section("monitoring-history","Monitoring edit history","Audit & edit history","Saved case and activity changes with their reasons. Selected by the time of the edit.",
        [["case","Case ID"],["subject","Person / household"],["action","Action"],["actor","Recorded by"],["reason","Reason"],["changes","Before / after"],["at","Changed"]],
        allMatching.flatMap(c=>Object.values(c.history||{}).filter(h=>inPeriod(h.at,f)).map(h=>({case:c.id,subject:c.person.fullName,action:h.action,actor:label(h.actorName||name(h.by)),reason:label(h.reason),changes:describeChange(h.before,h.after),at:dateTime(h.at),_at:h.at}))).sort((a,b)=>Number(b._at)-Number(a._at))));
    }
  }
  if(want("residents")) {
    const residents=d.users.filter(u=>isResident(u.role)&&matchesStatus(u.accountStatus||u.status,f.status)&&(!f.purok||purok(u.purokId||u.purokLabel)===f.purok)&&matchesSearch([u.uid,u.fullName,u.email,u.phone,u.contactNumber,u.address,u.purokId],f.search));
    const ids=new Set(residents.map(u=>u.uid));
    add(section("residents","Resident app accounts","Resident accounts","App accounts are separate from inhabitants. Unknown account status is shown as not recorded.",
      [["id","Account ID"],["name","Resident"],["contact","Phone / email"],["location","Purok / address"],["status","Account status"],["registered","Registered"],["updated","Last updated"]],
      residents.map(u=>({id:u.uid,name:u.fullName,contact:`${label(u.contactNumber||u.phone)}\n${label(u.email)}`,location:`${purok(u.purokId||u.purokLabel)}\n${label(u.address)}`,status:titleCase(u.accountStatus||u.status),registered:dateTime(u.createdAt),updated:dateTime(u.updatedAt)}))),
    section("resident-health","Saved resident medical profiles","Resident accounts","Only saved profiles associated with resident accounts. These are app profile entries, not new diagnoses or monitoring outcomes.",
      [["id","Account ID"],["resident","Resident"],["blood","Blood type / allergies"],["conditions","Conditions / medications"],["history","Medical history"],["contact","Doctor / contact"],["notes","Emergency notes"]],
      d.healthProfiles.filter(p=>ids.has(p.userId)).map(p=>({id:p.userId,resident:users.get(p.userId)?.fullName||p.userId,blood:`${label(p.bloodType)}\nAllergies: ${label(p.allergies)}`,conditions:`${label(p.conditions)}\nMedications: ${label(p.medications)}`,history:label(p.medicalHistory),contact:`${label(p.doctorName)}\n${label(p.doctorPhone)}`,notes:label(p.emergencyNote)}))));
  }
  if(want("responders")) {
    add(section("responders","Registered respondents","Respondent authorization","Current personnel, account status and availability. Date filters do not reconstruct previous duty status.",
      [["id","Respondent ID"],["name","Name / position"],["contact","Contact / email"],["area","Service area"],["availability","Availability"],["status","Account status"],["updated","Last updated"]],
      d.responders.filter(r=>matchesStatus(r.accountStatus,f.status)&&matchesSearch([r.id,r.name,r.email,r.contact,r.position,r.serviceArea,r.availability],f.search)).map(r=>({id:r.authUid||r.id,name:`${r.name}\n${label(r.position)}`,contact:`${label(r.contact)}\n${label(r.email)}`,area:label(r.serviceArea||r.assignedBarangayId),availability:titleCase(r.availability),status:titleCase(r.accountStatus),updated:dateTime(r.updatedAt)}))),
    section("applications","Respondent applications","Respondent authorization","Applications selected by submission date, with current review outcome. Identity document images are not embedded in reports.",
      [["id","Application ID"],["name","Applicant"],["contact","Phone / email"],["organization","Organization / role"],["status","Review status"],["dates","Submitted / reviewed"],["notes","Review notes"]],
      d.respondentApplications.filter(a=>inPeriod(a.submittedAt,f)&&matchesStatus(a.status,f.status)&&matchesSearch([a.id,a.fullName,a.email,a.phone,a.organization,a.status],f.search)).map(a=>({id:a.id,name:a.fullName,contact:`${label(a.phone)}\n${label(a.email)}`,organization:`${label(a.organization)}\n${label(a.requestedRole)}`,status:titleCase(a.status),dates:`Submitted: ${dateTime(a.submittedAt)}\nReviewed: ${dateTime(a.reviewedAt)}`,notes:label(a.reviewMessage)}))),
    section("invitations","Retained respondent invitations","Respondent authorization","Invitation records selected by creation date.",
      [["id","Invitation ID"],["name","Respondent"],["email","Email"],["phone","Phone"],["status","Status"],["created","Created"]],
      d.respondentInvitations.filter(i=>inPeriod(i.createdAt,f)&&matchesStatus(i.status,f.status)&&matchesSearch([i.id,i.fullName,i.normalizedEmail,i.phone],f.search)).map(i=>({id:i.id,name:i.fullName,email:i.normalizedEmail,phone:i.phone,status:titleCase(i.status),created:dateTime(i.createdAt)}))));
  }
  if(want("directory")) {
    add(section("directory","Emergency contacts","Emergency directory","Current barangay and national directory records. Matching names across scopes are retained as separate directory entries.",
      [["id","Contact ID"],["name","Organization"],["scope","Directory"],["category","Category"],["phones","Primary / alternate"],["address","Address"],["status","Status"]],
      [...d.directoryContacts.map(c=>({...c,_scope:"Barangay"})),...d.globalContacts.map(c=>({...c,_scope:"National"}))].filter(c=>matchesStatus(c.active===false?"inactive":"active",f.status)&&matchesSearch([c.organizationName,c.shortName,c.category,c.phone,c.alternatePhone,c.address,c._scope],f.search)).map(c=>({id:c.id,name:label(c.organizationName||c.shortName),scope:c._scope,category:label(c.category),phones:`${label(c.phone)}\n${label(c.alternatePhone)}`,address:label(c.address),status:c.active===false?"Inactive":"Active"}))));
  }
  if(want("announcements")) {
    add(section("announcements","Public announcements","Announcements","Selected by creation date. Publication status is current; expiration is shown separately.",
      [["id","Announcement ID"],["title","Title / category"],["status","Status"],["message","Announcement message"],["author","Created by"],["created","Created"],["expires","Expires"]],
      d.announcements.filter(a=>inPeriod(a.createdAt,f)&&matchesStatus(a.status,f.status)&&matchesSearch([a.title,a.category,a.content,a.status],f.search)).map(a=>({id:a.id,title:`${a.title}\n${a.category}`,status:titleCase(a.status),message:a.content,author:name(a.createdBy),created:dateTime(a.createdAt),expires:a.expiresAt?dateTime(a.expiresAt):"No expiry"}))));
  }
  if(want("notifications")) {
    add(section("notifications","Notification requests","Notification requests","Saved queue processing records only. Sent or processed status does not confirm receipt on a phone or that the resident read it.",
      [["id","Request ID"],["recipient","Recipient"],["incident","Related incident"],["message","Title / message"],["status","Processing status"],["attempts","Attempts"],["dates","Created / updated"]],
      d.notifications.filter(n=>inPeriod(n.createdAt,f)&&matchesStatus(n.status,f.status)&&matchesSearch([n.id,n.title,n.message,n.type,n.incidentId,name(n.targetUserId)],f.search)).map(n=>({id:n.id,recipient:name(n.targetUserId),incident:label(n.incidentId),message:`${n.title}\n${n.message}`,status:titleCase(n.status),attempts:n.attempts,dates:`${dateTime(n.createdAt)}\nUpdated: ${dateTime(n.updatedAt)}`}))));
  }
  if(want("audit")) {
    add(section("audit","Administrative audit trail","Audit & edit history","Actions recorded by the existing application. This is not a claim that every historical action was captured.",
      [["id","Audit ID"],["action","Action"],["actor","Performed by"],["user","Related user"],["incident","Related incident"],["details","Details"],["at","Action date"]],
      d.auditLogs.filter(a=>inPeriod(a.timestamp||a.createdAt,f)&&matchesSearch([a.action,a.performedBy,name(a.performedBy),a.userId,a.incidentId,a.details],f.search)).map(a=>({id:a.id,action:a.action,actor:name(a.performedBy),user:name(a.userId),incident:label(a.incidentId),details:label(a.details),at:dateTime(a.timestamp||a.createdAt)}))));
  }
  return result;
}
function describeChange(before:unknown,after:unknown):string {
  const b=(before||{}) as Record<string,unknown>,a=(after||{}) as Record<string,unknown>;
  const fields=["program","condition","assignedTo","startDate","notes","status","completedDate","closureNotes","scheduledDate","actualDate","activityType","attendance","observations","result","actionTaken","referredTo","referralReason"];
  return fields.filter(k=>a[k]!==undefined&&a[k]!==b[k]).map(k=>`${k.replace(/([A-Z])/g," $1")}: ${label(b[k])} → ${label(a[k])}`).join("\n")||"No changes to report fields";
}
