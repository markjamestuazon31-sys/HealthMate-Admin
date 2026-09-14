import type { SystemReportData } from "../services/reportService";
import { SECTORS, todayInManila } from "../services/inhabitantModel";
import { sosUrgencyLabel } from "../services/sosUrgency";
import { buildReportSections } from "./reportSections";
import { REPORT_CATALOG, dateTime, titleCase, periodText, validateFilters, type GeneratedReport, type ReportFilters, type ReportMetric, type ReportSection, type ReportType } from "./reportModel";
export * from "./reportModel";

function metrics(type:ReportType,sections:ReportSection[]):ReportMetric[] {
  const rows=(id:string)=>sections.find(s=>s.id===id)?.rows||[];
  const count=(id:string)=>rows(id).length;
  const distinct=(id:string,key:string)=>new Set(rows(id).map(r=>r[key]).filter(Boolean)).size;
  const metric=(label:string,value:number|string,helper?:string):ReportMetric=>({label,value,helper,tone:"primary"});
  if(type==="complete")return [metric("SOS incidents",count("emergencies")),metric("Rescue submissions",count("rescue-submissions")),metric("Current inhabitants",rows("population-totals")[0]?.total??0),metric("Monitoring activities",count("monitoring-activities"))];
  if(type==="emergencies")return [metric("SOS incidents",count("emergencies")),metric("Critical SOS",rows("emergencies").filter(r=>r.priority==="Critical SOS").length),metric("Moderate SOS",rows("emergencies").filter(r=>r.priority==="Moderate SOS").length),metric("Active response",rows("emergencies").filter(r=>r._active===1).length)];
  if(type==="rescue")return [metric("Submissions",count("rescue-submissions")),metric("Respondent folders",count("rescue-folders")),metric("New reports",rows("rescue-submissions").filter(r=>r.group==="New").length),metric("Previous reports",rows("rescue-submissions").filter(r=>r.group==="Previous").length)];
  if(type==="heatmap")return [metric("Mapped incidents",count("heatmap-incidents")),metric("Puroks with incidents",rows("heatmap-summary").filter(r=>Number(r.total)>0).length),metric("Critical SOS",rows("heatmap-incidents").filter(r=>r.priority==="Critical SOS").length),metric("Absent from heatmap",count("unmapped-incidents"))];
  if(type==="population")return [metric("Households",count("households")),metric("Inhabitants",count("inhabitants")),metric("Active inhabitants",rows("inhabitants").filter(r=>r.status==="Active").length),metric("Profile date",todayInManila())];
  if(type==="population-summary")return rows("population-totals").map(r=>metric(String(r.indicator),r.total));
  if(type==="monitoring")return [metric("Cases started",count("monitoring-cases"),"Selected start dates"),metric("Activities",count("monitoring-activities"),"Selected activity dates"),metric("Overdue followups",rows("monitoring-activities").filter(r=>r._overdue===1).length),metric("Cases completed",count("monitoring-completed"),"Selected completion dates")];
  if(type==="programs")return [metric("Programs with activity",count("program-results")),metric("Recorded activities",count("program-activity-detail")),metric("People monitored",distinct("program-activity-detail","_person"),"Unique individual records"),metric("Households reached",distinct("program-activity-detail","_household"),"Unique recorded household IDs")];
  if(type==="residents")return [metric("Resident accounts",count("residents")),metric("Saved medical profiles",count("resident-health")),metric("Active accounts",rows("residents").filter(r=>r.status==="Active").length)];
  if(type==="responders")return [metric("Registered respondents",count("responders")),metric("Available now",rows("responders").filter(r=>r.availability==="Available").length),metric("Applications",count("applications")),metric("Invitations",count("invitations"))];
  if(type==="directory")return [metric("Contacts",count("directory")),metric("Barangay contacts",rows("directory").filter(r=>r.scope==="Barangay").length),metric("National contacts",rows("directory").filter(r=>r.scope==="National").length),metric("Active contacts",rows("directory").filter(r=>r.status==="Active").length)];
  if(type==="announcements")return [metric("Announcements",count("announcements")),...(["Published","Draft","Archived"].map(status=>metric(status,rows("announcements").filter(r=>r.status===status).length)))];
  if(type==="notifications")return [metric("Requests",count("notifications")),metric("Queued",rows("notifications").filter(r=>r.status==="Queued").length),metric("Failed",rows("notifications").filter(r=>r.status==="Failed").length)];
  return [metric("Audit entries",count("audit")),metric("Monitoring edits",count("monitoring-history")),metric("Urgency reviews",count("urgency-history"))];
}
export function describeReportFilter(key:keyof ReportFilters,value:string,data:SystemReportData):string {
  const labels:Partial<Record<keyof ReportFilters,string>>={search:"Search",purok:"Purok",status:"Status",priority:"SOS urgency",program:"Program",household:"Household",member:"Member",staff:"Staff",sex:"Sex",sector:"Population sector",scope:"Scope",condition:"Condition",respondent:"Respondent"};
  const text=key==="program"?data.monitoringPrograms.find(p=>p.id===value)?.name||value:key==="household"?data.households.find(h=>h.id===value)?.householdName||value:key==="member"?data.inhabitants.find(p=>p.id===value)?.fullName||value:key==="respondent"?data.responders.find(r=>(r.authUid||r.id)===value)?.name||value:key==="priority"?sosUrgencyLabel(value):key==="sector"?SECTORS.find(s=>s[0]===value)?.[1]||value:key==="scope"?(value==="person"?"Individual":"Household"):["status","sex"].includes(key)?titleCase(value):value;
  return `${labels[key]||key}: ${text}`;
}
export function buildGeneratedReport(type:ReportType,data:SystemReportData,filters:ReportFilters):GeneratedReport {
  const def=REPORT_CATALOG.find(d=>d.id===type);if(!def)throw new Error("Choose a report.");
  const f={...filters,...(def.static?{startDate:"",endDate:""}:{})};validateFilters(f);
  const referenceDate=todayInManila(),sections=buildReportSections(type,data,f,referenceDate);
  const filterLabels:string[]=[];
  for(const [key,value] of Object.entries(f)) {
    if(value && !["startDate","endDate","activityDate"].includes(key)) filterLabels.push(describeReportFilter(key as keyof ReportFilters,String(value),data));
  }
  if(type==="monitoring"||type==="complete")filterLabels.push(`Activity date: ${f.activityDate==="actual"?"Actual":"Scheduled"}`);
  return {type,title:def.title,description:def.description,generatedAt:Date.now(),referenceDate,periodLabel:def.static?`Current records • ${referenceDate}`:periodText(f),filters:f,filterLabels,metrics:metrics(type,sections),sections,totalRows:sections.reduce((sum,s)=>sum+s.rows.length,0),notes:[def.dateNote,"Table rows include summaries and details of the same records. They are not a count of unique people or incidents."]};
}
export function selectReportSection(report:GeneratedReport,id:string):GeneratedReport {
  const section=report.sections.find(s=>s.id===id);if(!section)throw new Error("Choose an available report section.");
  return {...report,title:section.title,description:section.description,metrics:[],sections:[section],totalRows:section.rows.length};
}
export function csvCell(value:unknown):string {
  let text=String(value??""); if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;
  return `"${text.replace(/"/g,'""')}"`;
}
export function reportCsv(report:GeneratedReport):string {
  const rows:unknown[][]=[["HealthMate Reports"],[report.title],["Generated (Philippine time)",dateTime(report.generatedAt)],["Period",report.periodLabel],...report.filterLabels.map(f=>[f]),...report.notes.map(n=>["Note",n]),[],...report.metrics.map(m=>[m.label,m.value,m.helper||""])];
  for(const section of report.sections){rows.push([],[section.title],[section.description],section.columns.map(c=>c.label),...section.rows.map(r=>section.columns.map(c=>r[c.key]??"")));}
  return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
}
export function downloadReportCsv(report:GeneratedReport) {
  const url=URL.createObjectURL(new Blob([reportCsv(report)],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download=`HealthMate_${report.type}_${report.referenceDate}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const html=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
function sectionHtml(s:ReportSection,newGroup=false) {
  // Repeated identity columns keep wide reports readable without reducing print type size.
  const groups=s.columns.length<=7?[s.columns]:Array.from({length:Math.ceil((s.columns.length-1)/5)},(_,i)=>[s.columns[0],...s.columns.slice(1+i*5,1+(i+1)*5)]);
  return `<section class="report-section${newGroup?" group-start":""}"><p class="group">${html(s.group)}</p><h2>${html(s.title)}</h2><p>${html(s.description)}</p>${groups.map((cols,i)=>`${groups.length>1?`<p class="small">Column group ${i+1} of ${groups.length}. Identity repeats across groups.</p>`:""}<table><caption>${html(s.title)} • ${s.rows.length} rows</caption><thead><tr>${cols.map(c=>`<th>${html(c.label)}</th>`).join("")}</tr></thead><tbody>${s.rows.length?s.rows.map(r=>`<tr>${cols.map(c=>`<td>${html(r[c.key]??"")}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${cols.length}">No matching records.</td></tr>`}</tbody></table>`).join("")}</section>`;
}
export function reportPrintHtml(report:GeneratedReport):string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${html(report.title)}</title><style>
  @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172c40;background:#fff;font:11pt/1.45 Arial,"Segoe UI",sans-serif}.print-toolbar{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px;background:#eef4ff;border-bottom:1px solid #b8cae3}.print-toolbar button{font:inherit;padding:10px 18px;cursor:pointer;background:#0959ce;color:white;border:0;border-radius:8px}.shell{max-width:1250px;margin:auto;padding:24px}.brand{border-bottom:3px solid #9c251b;padding-bottom:12px;display:flex;justify-content:space-between;gap:24px}.brand strong{font-size:20pt;color:#8c221a}.brand span{display:block}.small{font-size:10pt;color:#43566c}h1{font-size:23pt;line-height:1.2;margin:22px 0 8px}h2{font-size:16pt;line-height:1.3;margin:4px 0 8px;break-after:avoid}p{margin:6px 0 12px}.metadata{border:1px solid #cbd5df;padding:12px;margin:16px 0}.metrics{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.metric{flex:1;min-width:180px;padding:12px;border:1px solid #cbd5df}.metric b{font-size:20pt;display:block}.metric span{display:block}.report-section{margin-top:24px;break-before:auto}.group-start{break-before:page}.group{text-transform:uppercase;letter-spacing:.7px;font-weight:bold;color:#495b6e;font-size:10pt;margin-bottom:5px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 22px}caption{text-align:left;font-weight:bold;margin-bottom:6px}thead{display:table-header-group}th{background:#edf2f7;text-align:left;font-weight:bold}td,th{padding:9px;border:1px solid #aebdca;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;font-size:11pt}tr{break-inside:avoid}footer{margin-top:24px;border-top:1px solid #b8c6d4;padding-top:10px;font-size:10pt}.contents{columns:2;line-height:1.8}@media print{.print-toolbar{display:none}.shell{max-width:none;padding:0}.report-section:first-of-type{break-before:auto}body{color:#000}.metric{break-inside:avoid}}
  </style></head><body><div class="print-toolbar"><span>Print preview • A4 landscape • 11 pt text</span><button onclick="window.print()">Print / Save PDF</button></div><main class="shell"><header class="brand"><div><strong>HealthMate</strong><span>Barangay Bunuanan • City of Catbalogan</span></div><div>Administration report<br><span class="small">Philippine time (UTC+08:00)</span></div></header><h1>${html(report.title)}</h1><p>${html(report.description)}</p><div class="metadata"><div><b>Generated:</b> ${html(dateTime(report.generatedAt))}</div><div><b>Period:</b> ${html(report.periodLabel)}</div>${report.filterLabels.map(f=>`<div>${html(f)}</div>`).join("")}</div>${report.notes.map(n=>`<p class="small">${html(n)}</p>`).join("")}<div class="metrics">${report.metrics.map(m=>`<div class="metric"><span>${html(m.label)}</span><b>${html(m.value)}</b>${m.helper?`<span class="small">${html(m.helper)}</span>`:""}</div>`).join("")}</div>${report.sections.length>1?`<h2>Report contents</h2><ol class="contents">${report.sections.map(s=>`<li>${html(s.title)} (${s.rows.length} rows)</li>`).join("")}</ol>`:""}${report.sections.map((s,i)=>sectionHtml(s,i>0&&s.group!==report.sections[i-1].group)).join("")}<footer>Generated from the records available to the signed in administrator at the time shown. Empty sections mean no matching records in this report.</footer></main></body></html>`;
}
export function printGeneratedReport(report:GeneratedReport) {
  const popup=window.open("","_blank","width=1280,height=900");
  if(!popup)throw new Error("Allow popups for HealthMate to open the print preview.");
  try{popup.opener=null;}catch{/* Some browsers retain a protected opener. */}
  popup.document.open();popup.document.write(reportPrintHtml(report));popup.document.close();popup.focus();
}
