import type { Household } from "../types";
import { ageOn, familyCount, personLocation, populationSummary, socialLabels, SOCIAL_FIELDS, type RegistryInhabitant } from "../services/inhabitantModel";

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function csvText(rows: unknown[][]): string { return rows.map(row => row.map(csvCell).join(",")).join("\r\n"); }
export function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", csvText(rows)], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function inhabitantsRows(people: RegistryInhabitant[], households: Household[], date: string): unknown[][] {
  const byId = new Map(households.map(h => [h.id, h]));
  return [["Record ID", "Full name", "Birthday", `Age on ${date}`, "Sex", "Civil status", "Citizenship", "Nationality", "Address", "Purok", "Mobile", "Household", "Family number", "Relationship to head", "Household head", "Status", "Occupation", "Employment status", "Personal monthly income (PHP)", "School attendance", ...SOCIAL_FIELDS.map(([, label]) => label), "Senior (60+)", "Health conditions", "Medical history", "Past treatments", "Emergency notes", "Profiling remarks"],
    ...people.map(p => {
      const h = byId.get(p.householdId), location = personLocation(p, h), age = ageOn(p.birthDate, date);
      return [p.id, p.fullName, p.birthDate, age, p.sex, p.civilStatus, p.citizenship, p.nationality, location.address, location.purokId, p.phone, h?.householdName, p.familyNumber, p.relationshipToHead, p.isHouseholdHead ? "Yes" : "No", p.status, p.occupation, p.employmentStatus, p.monthlyIncome, p.schoolAttendance,
        ...SOCIAL_FIELDS.map(([key]) => p[key] === true ? "Yes" : p[key] === false ? "No" : "Not recorded"), age === null ? "Not recorded" : age >= 60 ? "Yes" : "No", p.medicalConditions, p.medicalHistory, p.pastTreatments, p.emergencyNotes, p.profileNotes];
    })];
}
export function householdsRows(households: Household[], people: RegistryInhabitant[]): unknown[][] {
  return [["Record ID", "Household", "Head", "Purok", "Address", "House / unit number", "Landmark", "Type", "Tenure", "Primary mobile", "Secondary mobile", "Monthly income (PHP)", "All members", "Active members", "Recorded active families", "Status"],
    ...households.map(h => {
      const members = people.filter(p => p.householdId === h.id), active = members.filter(p => p.status === "active");
      return [h.id, h.householdName, h.householdHeadName, h.purokId, h.address, h.unitNumber, h.landmark, h.householdType, h.tenureStatus, h.primaryContact, h.secondaryContact, h.monthlyIncome, members.length, active.length, familyCount(active), h.status];
    })];
}
export function summaryRows(people: RegistryInhabitant[], households: Household[], date: string, purok: string): unknown[][] {
  const summary = populationSummary(people, date);
  const rows: unknown[][] = [["Barangay Bunuanan — population monitoring summary"], ["Location", "Catbalogan City, Samar, Region VIII"], ["Scope", purok || "All Puroks"], ["As of", date], ["Current inhabitants", people.length], ["Active households", households.length], ["Recorded families", familyCount(people)], ["Family number not recorded", people.filter(p => !p.householdId || !p.familyNumber).length], [], ["Indicators", "Male", "Female", "Other / not recorded", "Total", "Remarks"]];
  for (const [title, group] of [["Population by age bracket", summary.ages], ["Population by sector", summary.sectors], ["Civil status", summary.civil], ["Citizenship", summary.citizenship]] as const) {
    rows.push([title]);
    group.forEach(r => rows.push([r.label, r.male, r.female, r.other, r.total, r.other ? "Total includes other / unrecorded sex" : ""]));
  }
  rows.push([summary.total.label, summary.total.male, summary.total.female, summary.total.other, summary.total.total]);
  rows.push([], ["Notes", "Current active inhabitants; inactive/relocated households excluded. Sector categories can overlap. Unknown flags are not counted as No. Figures use saved records, not the reference photograph."]);
  return rows;
}
const escapeHtml = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function printPopulationSummary(people: RegistryInhabitant[], households: Household[], date: string, purok: string): boolean {
  return openPrintDocument(populationPrintHtml(people, households, date, purok));
}

function reportHtml(title: string, date: string, content: string, landscape = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | ${escapeHtml(date)}</title><style>
    @page{size:A4 ${landscape ? "landscape" : "portrait"};margin:14mm}
    *{box-sizing:border-box}body{font:12pt/1.5 Arial,"Helvetica Neue",sans-serif;color:#111;background:#fff;margin:0}
    main{max-width:${landscape ? "269mm" : "182mm"};margin:24px auto;padding:0 12px}
    h1{font-size:20pt;line-height:1.25;margin:0 0 8px;font-weight:700}
    p{margin:8px 0 14px;overflow-wrap:anywhere}.subtitle{font-size:11pt}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:18px 0;font-size:11pt}
    .meta div{overflow-wrap:anywhere}.scope{font-size:11pt;border:1px solid #777;padding:10px 12px;margin:16px 0}
    .report-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11pt;line-height:1.4;margin:18px 0 22px;font-variant-numeric:tabular-nums}
    th,td{border:1px solid #777;padding:7px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word;white-space:normal}
    th{font-weight:700;background:#edf0f3}thead{display:table-header-group;break-inside:avoid;page-break-inside:avoid}th[scope="col"]{overflow-wrap:normal;word-wrap:normal}tfoot{display:table-row-group}
    tr{break-inside:avoid;page-break-inside:avoid}.group th{font-size:12pt;background:#e3e8ed;text-align:left}
    .number{text-align:right}.total-row{font-weight:700}.notes{font-size:11pt;orphans:3;widows:3}
    .signatures{display:flex;justify-content:space-between;gap:32px;margin-top:38px;break-inside:avoid;page-break-inside:avoid;font-size:11pt}
    .signatures div{width:46%;border-top:1px solid #111;padding-top:9px}.secondary{display:block;margin-top:4px}
    .actions{display:flex;align-items:center;flex-wrap:wrap;gap:14px;background:#f1f4f7;border-bottom:1px solid #c4cbd3;padding:16px 24px;font:16px/1.5 Arial,sans-serif}
    .actions button{font:600 16px/1.5 Arial,sans-serif;padding:10px 18px;color:#fff;background:#0b5ed7;border:1px solid #084baf;border-radius:6px;cursor:pointer}
    .actions button:focus-visible{outline:3px solid #111;outline-offset:3px}
    @media print{html,body{width:auto;margin:0;padding:0}main{max-width:none;margin:0;padding:0}.actions{display:none}th{color:#000}h1{break-after:avoid;page-break-after:avoid}}
    @media screen and (max-width:700px){main{margin:20px 0;padding:0 16px;min-width:660px}.meta{gap:8px 16px}}
  </style></head><body><div class="actions"><button id="print" type="button">Print / Save as PDF</button><span>A4 ${landscape ? "landscape" : "portrait"} · Select Actual size or 100% scale for readable text.</span></div><main><header><h1>${escapeHtml(title)}</h1><p class="subtitle">Barangay Bunuanan · City of Catbalogan · Samar · Region VIII<br>As of ${escapeHtml(date)}</p></header>${content}</main></body></html>`;
}

function openPrintDocument(html: string): boolean {
  const win = window.open("", "_blank", "width=1200,height=900");
  if (!win) return false;
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.document.getElementById("print")?.addEventListener("click", () => win.print());
    win.focus();
    return true;
  } catch {
    win.close();
    return false;
  }
}

export function populationPrintHtml(people: RegistryInhabitant[], households: Household[], date: string, purok: string): string {
  const rows = summaryRows(people, households, date, purok), headerIndex = rows.findIndex(r => r[0] === "Indicators");
  const groups: { title: string; rows: unknown[][] }[] = [];
  for (const row of rows.slice(headerIndex + 1, -3)) {
    if (row.length === 1) groups.push({ title: String(row[0]), rows: [] });
    else if (row.length) groups[groups.length - 1]?.rows.push(row);
  }
  const total = rows[rows.length - 3];
  // Keep the overall population total separate from citizenship indicators.
  const tables = groups.map(group => `<table class="report-table" aria-label="${escapeHtml(group.title)}"><colgroup>${[35, 9, 12, 16, 9, 19].map(w => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr class="group"><th colspan="6">${escapeHtml(group.title)}</th></tr><tr>${rows[headerIndex].map((v, i) => `<th scope="col"${i > 0 && i < 5 ? ' class="number"' : ""}>${escapeHtml(v)}</th>`).join("")}</tr></thead><tbody>${group.rows.map(row => `<tr>${Array.from({ length: 6 }, (_, i) => i === 0 ? `<th scope="row" style="background:#fff;font-weight:400">${escapeHtml(row[i])}</th>` : `<td${i < 5 ? ' class="number"' : ""}>${escapeHtml(row[i])}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join("");
  return reportHtml("Population monitoring summary", date, `<p class="subtitle">RBI Form C indicators · Current registry</p><div class="meta">${rows.slice(2,8).map(r => `<div><strong>${escapeHtml(r[0])}:</strong> ${escapeHtml(r[1])}</div>`).join("")}</div>${tables}<p class="total-row">${escapeHtml(total[0])}: ${escapeHtml(total[4])} · Male: ${escapeHtml(total[1])} · Female: ${escapeHtml(total[2])} · Other / not recorded: ${escapeHtml(total[3])}</p><p class="notes">${escapeHtml(rows[rows.length - 1][1])}</p><div class="signatures"><div>Prepared by / Barangay Secretary</div><div>Submitted by / Punong Barangay</div></div>`);
}

export function directoryPrintHtml(kind: "inhabitants" | "households", people: RegistryInhabitant[], households: Household[], date: string, filters: string[]): string {
  const byId = new Map(households.map(h => [h.id, h]));
  const cell = (value: unknown) => escapeHtml(value === "" || value === null || value === undefined ? "Not recorded" : value);
  const count = kind === "inhabitants" ? people.length : households.length;
  const headers = kind === "inhabitants" ? ["Inhabitant", "Age / sex", "Household / location", "Contact", "Recorded sectors", "Status"] : ["Household", "Location", "Household head", "Contact", "Members", "Status"];
  const widths = kind === "inhabitants" ? [21, 12, 28, 14, 15, 10] : [21, 26, 19, 14, 11, 9];
  const memberCounts = new Map<string, { total: number; active: number }>();
  people.forEach(p => { const counts = memberCounts.get(p.householdId) || { total: 0, active: 0 }; counts.total++; if (p.status === "active") counts.active++; memberCounts.set(p.householdId, counts); });
  const records = kind === "inhabitants" ? people.map(p => {
    const household = byId.get(p.householdId), location = personLocation(p, household), age = ageOn(p.birthDate, date);
    return [cell(p.fullName), `${age === null ? "Age not recorded" : `${age} years`}<span class="secondary">${cell(p.sex)}</span>`, `${household ? cell(household.householdName) : "Household not assigned"}<span class="secondary">${cell(location.purokId)} · ${cell(location.address)}</span>`, cell(p.phone), cell(socialLabels(p, date).join(", ") || "No recorded category"), cell(p.status)];
  }) : households.map(h => {
    const counts = memberCounts.get(h.id) || { total: 0, active: 0 };
    return [cell(h.householdName), `${cell(h.purokId)}<span class="secondary">${cell(h.address)}</span>`, cell(h.householdHeadName), cell(h.primaryContact), `${counts.total}<span class="secondary">${counts.active} active</span>`, cell(h.status)];
  });
  return reportHtml(kind === "inhabitants" ? "Inhabitant masterlist" : "Household directory", date, `<p class="scope"><strong>${count.toLocaleString()} matching records</strong><br>${filters.length ? filters.map(escapeHtml).join(" · ") : "All records"}<br>Includes every matching record across all directory pages.</p><table class="report-table"><colgroup>${widths.map(w => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${records.length ? records.map(record => `<tr>${record.map((value, i) => i === 0 ? `<th scope="row" style="background:#fff">${value}</th>` : `<td>${value}</td>`).join("")}</tr>`).join("") : '<tr><td colspan="6">No matching records.</td></tr>'}</tbody></table>`, true);
}

export function printRegistryDirectory(kind: "inhabitants" | "households", people: RegistryInhabitant[], households: Household[], date: string, filters: string[]): boolean {
  return openPrintDocument(directoryPrintHtml(kind, people, households, date, filters));
}
