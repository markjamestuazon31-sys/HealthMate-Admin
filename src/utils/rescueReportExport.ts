import { reportCaseStatus, reportDate, reportLabel, type RespondentReportEntry } from "../services/rescueReportModel";

function html(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
function csv(value: unknown): string {
  let text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function rescueReportsCsv(entries: RespondentReportEntry[]): string {
  const headers = ["Respondent", "Respondent UID", "Patient", "Incident ID", "Report type", "Folder", "Submitted (Philippine time)", "Classification", "Case review status", "Summary", "Observed condition", "Actions performed", "Agencies contacted", "Transport destination", "Notes"];
  return "\uFEFF" + [headers, ...entries.map(entry => [
    entry.respondent.name, entry.ownerUid, entry.patient, entry.incidentId,
    entry.kind === "final" ? "Final report" : "Individual report", entry.isNew ? "New reports" : "Previous reports",
    reportDate(entry.submittedAt), reportLabel(entry.classification), reportCaseStatus(entry.caseReport).label,
    entry.summary, entry.narrative.observedCondition, entry.narrative.actionsPerformed,
    entry.narrative.agenciesContacted, entry.narrative.transportDestination, entry.narrative.notes,
  ])].map(row => row.map(csv).join(",")).join("\r\n");
}
export function downloadRescueReports(entries: RespondentReportEntry[], title: string) {
  const blob = new Blob([rescueReportsCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "Rescue_reports"}.csv`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function printRescueReport(entry: RespondentReportEntry) {
  const target = window.open("", "_blank", "width=960,height=760");
  if (!target) throw new Error("Allow popups for HealthMate to print this report.");
  try { target.opener = null; } catch { /* Browser controls the opener. */ }
  const fields = [
    ["Patient", entry.patient], ["Submitted by", entry.respondent.name], ["Respondent UID", entry.ownerUid],
    ["Incident ID", entry.incidentId], ["Report type", entry.kind === "final" ? "Final report" : "Individual report"],
    ["Submitted", reportDate(entry.submittedAt)], ["Classification", reportLabel(entry.classification)],
    ["Case status", reportCaseStatus(entry.caseReport).label],
    ["Recorded arrival", entry.narrative.arrivalAt ? reportDate(entry.narrative.arrivalAt) : "Not recorded"],
    ["Recorded completion", entry.narrative.completedAt ? reportDate(entry.narrative.completedAt) : "Not recorded"],
  ];
  const sections = [
    ...(entry.kind === "final" ? [["Final summary", entry.summary]] : []),
    ["Observed condition", entry.narrative.observedCondition], ["Actions performed", entry.narrative.actionsPerformed],
    ["Agencies contacted", entry.narrative.agenciesContacted], ["Transport destination", entry.narrative.transportDestination],
    ["Additional notes", entry.narrative.notes], ["Administrative review notes", entry.caseReport.final?.reviewNotes],
  ];
  target.document.open();
  target.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rescue report | ${html(entry.respondent.name)}</title>
    <style>@page{size:A4;margin:17mm}*{box-sizing:border-box}body{font:12px/1.55 Arial,sans-serif;color:#172b3a;margin:0}header{border-bottom:3px solid #b42318;padding-bottom:14px;margin-bottom:20px}h1{font-size:24px;margin:4px 0}header small{color:#b42318;font-weight:bold;letter-spacing:1px}dl{display:grid;grid-template-columns:1fr 1fr;gap:12px 26px}dl div{min-width:0}dt,h2{color:#4a5c6d;font-size:11px;font-weight:bold}dd{margin:3px 0 0;overflow-wrap:anywhere}section{margin-top:19px}h2{text-transform:uppercase;margin-bottom:6px}p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}footer{border-top:1px solid #ddd;margin-top:25px;padding-top:10px;font-size:10px;color:#526477}.print-button{padding:9px 18px;margin:15px 0}@media print{.print-button{display:none}h2{break-after:avoid}dl div{break-inside:avoid}}</style></head>
    <body><button class="print-button" onclick="window.print()">Print / Save as PDF</button><header><small>HEALTHMATE · RESCUE OPERATIONS</small><h1>Rescue report</h1><p>${html(entry.respondent.name)} · ${html(entry.patient)}</p></header>
    <dl>${fields.map(([name, value]) => `<div><dt>${html(name)}</dt><dd>${html(value)}</dd></div>`).join("")}</dl>
    ${sections.map(([name, value]) => `<section><h2>${html(name)}</h2><p>${html(value || "Not recorded")}</p></section>`).join("")}
    <footer>All dates and times use Philippine time. Generated ${html(reportDate(Date.now()))}. This report contains personal information.</footer>
    <script>window.addEventListener('load',()=>window.print());<\/script></body></html>`);
  target.document.close();
}
