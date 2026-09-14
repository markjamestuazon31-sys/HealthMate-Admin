import { useEffect, useMemo, useState } from "react";
import { Alert, Avatar, CircularProgress, Snackbar } from "@mui/material";
import {
  ArrowBackRounded, ArrowForwardRounded, CheckCircleOutlineRounded, ChevronRightRounded,
  CloseRounded, DescriptionOutlined, DownloadRounded, FolderOpenOutlined, FolderOutlined,
  HistoryRounded, InboxOutlined, RefreshRounded, SearchRounded,
} from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import RescueReportDetails from "../components/reports/RescueReportDetails";
import {
  EMPTY_RESCUE_WORKSPACE, listenRescueReportWorkspace, type RescueReportWorkspace,
} from "../services/rescueReportService";
import {
  reportCaseStatus, reportDate, reportMatches,
  type RespondentReportEntry, type RespondentReportFolder,
} from "../services/rescueReportModel";
import { downloadRescueReports } from "../utils/rescueReportExport";
import "../styles/rescue-reports.css";

type ReportView = "new" | "previous" | "all";
const PAGE_SIZE = 12;
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }

function FolderCard({ folder, onOpen }: { folder: RespondentReportFolder; onOpen: () => void }) {
  const { respondent, reports, newCount, previousCount, latestAt } = folder;
  return <button className="rr-folder-card" type="button" onClick={onOpen} aria-label={`Open ${respondent.name} folder, ${reports.length} reports`}>
    <div className="rr-folder-card-top"><span className="rr-folder-symbol"><FolderOutlined /></span>
      {newCount > 0 ? <span className="rr-badge rr-badge-new">{newCount} new</span> : <span className="rr-folder-total">{reports.length} {reports.length === 1 ? "report" : "reports"}</span>}
    </div>
    <div className="rr-folder-person"><Avatar src={respondent.photo || undefined} alt="" sx={{ width: 40, height: 40, fontSize: 13, bgcolor: "#EDF2F7", color: "#51657A" }}>{initials(respondent.name)}</Avatar>
      <span className="rr-person-text"><strong title={respondent.name}>{respondent.name}</strong><small title={respondent.email || respondent.uid}>{respondent.email || `${respondent.position} · ${respondent.uid.slice(-6)}`}</small></span>
    </div>
    <div className="rr-folder-counts"><span><i className="rr-dot rr-dot-new" />{newCount} new</span><span><i className="rr-dot" />{previousCount} previous</span></div>
    <div className="rr-folder-card-footer"><span>{latestAt ? `Latest ${reportDate(latestAt, false)}` : "No reports submitted yet"}</span><ArrowForwardRounded fontSize="small" /></div>
  </button>;
}

function ReportRow({ entry, onOpen }: { entry: RespondentReportEntry; onOpen: () => void }) {
  const status = reportCaseStatus(entry.caseReport);
  return <tr>
    <td className="rr-report-patient"><span className={`rr-row-icon ${entry.kind === "final" ? "is-final" : ""}`}><DescriptionOutlined fontSize="small" /></span>
      <span><button className="rr-report-title" onClick={onOpen}>{entry.patient}</button><small title={entry.incidentId}>Incident {entry.incidentId}</small></span>
    </td>
    <td data-label="Report type"><span className={`rr-kind ${entry.kind === "final" ? "rr-kind-final" : ""}`}>{entry.kind === "final" ? "Final report" : "Individual report"}</span></td>
    <td data-label="Submitted"><time>{reportDate(entry.submittedAt, false)}</time><small>{entry.submittedAt ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(entry.submittedAt) : ""}</small></td>
    <td data-label="Case status"><span className={`rr-badge rr-badge-${status.tone}`}>{status.label}</span></td>
    <td className="rr-report-action"><button className="rr-icon-button" onClick={onOpen} aria-label={`Open ${entry.kind} report for ${entry.patient}`}><ChevronRightRounded /></button></td>
  </tr>;
}

export default function RescueReports() {
  const [workspace, setWorkspace] = useState<RescueReportWorkspace>(EMPTY_RESCUE_WORKSPACE);
  const [parameters, setParameters] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [exportError, setExportError] = useState("");
  const folderUid = parameters.get("respondent") || "";
  const requestedView = parameters.get("view");
  const view: ReportView = requestedView === "previous" || requestedView === "all" ? requestedView : "new";

  useEffect(() => listenRescueReportWorkspace(setWorkspace), [reload]);
  useEffect(() => { setQuery(""); setPage(0); setSort("recent"); }, [folderUid]);
  useEffect(() => { setPage(0); }, [query, sort, view]);
  useEffect(() => {
    if (selectedKey && workspace.ready && !workspace.errors.rescueReports && !workspace.entries.some(item => item.key === selectedKey)) {
      setSelectedKey(null); setNotice("This report is no longer available.");
    }
  }, [workspace, selectedKey]);

  const folder = workspace.folders.find(item => item.respondent.uid === folderUid);
  const reportFailure = Boolean(workspace.errors.rescueReports);
  const identityFailure = Boolean(workspace.errors.users || workspace.errors.respondents);
  const incidentFailure = Boolean(workspace.errors.emergencies);
  const newTotal = workspace.entries.filter(entry => entry.isNew).length;
  const previousTotal = workspace.entries.length - newTotal;
  const selectedEntry = workspace.entries.find(entry => entry.key === selectedKey) || null;
  const caseEntries = selectedEntry ? workspace.entries.filter(entry => entry.incidentId === selectedEntry.incidentId) : [];

  const visibleFolders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspace.folders.filter(item => [item.respondent.name, item.respondent.email, item.respondent.uid, item.respondent.position]
      .join(" ").toLowerCase().includes(normalized)).sort((a, b) => sort === "name"
        ? a.respondent.name.localeCompare(b.respondent.name)
        : b.latestAt - a.latestAt || a.respondent.name.localeCompare(b.respondent.name));
  }, [workspace.folders, query, sort]);

  const visibleReports = useMemo(() => (folder?.reports || [])
    .filter(entry => view === "all" || (view === "new" ? entry.isNew : !entry.isNew))
    .filter(entry => reportMatches(entry, query))
    .sort((a, b) => {
      const difference = (b.submittedAt || b.updatedAt) - (a.submittedAt || a.updatedAt);
      return (sort === "oldest" ? -difference : difference) || a.key.localeCompare(b.key);
    }), [folder, view, query, sort]);
  const totalVisible = folderUid ? visibleReports.length : visibleFolders.length;
  const pageCount = Math.max(1, Math.ceil(totalVisible / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;

  function openFolder(item: RespondentReportFolder) {
    setParameters({ respondent: item.respondent.uid, view: item.newCount ? "new" : item.previousCount ? "previous" : "new" });
  }
  function allFolders() { setParameters({}); setSelectedKey(null); }
  function setView(value: ReportView) { setParameters({ respondent: folderUid, view: value }, { replace: true }); }
  function exportReports() {
    setExportError("");
    try {
      const entries = folder ? visibleReports : workspace.entries;
      downloadRescueReports(entries, folder ? `${folder.respondent.name}_${view}_rescue_reports` : "HealthMate_rescue_reports");
      setNotice(`Exported ${entries.length} ${entries.length === 1 ? "report" : "reports"}.`);
    } catch (caught) { setExportError(caught instanceof Error ? caught.message : "Unable to export the reports."); }
  }
  const exportCount = folder ? visibleReports.length : workspace.entries.length;
  const blocked = !workspace.ready || reportFailure;

  return <div className="rr-page">
    <header className="rr-page-header"><div><p className="rr-eyebrow">Emergency operations</p><h1>Rescue reports</h1><p className="rr-page-subtitle">Every responders. Every report. One organized workspace.</p></div>
      <div className="rr-header-actions"><button className="rr-icon-button rr-refresh" type="button" onClick={() => setReload(value => value + 1)} aria-label="Refresh reports" disabled={!workspace.ready}><RefreshRounded /></button>
        <button className="rr-button" type="button" onClick={exportReports} disabled={blocked || !exportCount}><DownloadRounded fontSize="small" /> Export {folder ? "reports" : "all"}</button>
      </div>
    </header>

    <section className="rr-metrics" aria-label="Report overview">
      <div className="rr-metric"><span className="rr-metric-icon rr-metric-folder"><FolderOutlined /></span><div><span>Responders Record</span><strong>{blocked ? "…" : workspace.folders.length}</strong></div></div>
      <div className="rr-metric"><span className="rr-metric-icon rr-metric-new"><InboxOutlined /></span><div><span>New reports</span><strong>{blocked || incidentFailure ? "…" : newTotal}</strong></div><small>Awaiting a decision</small></div>
      <div className="rr-metric"><span className="rr-metric-icon rr-metric-previous"><HistoryRounded /></span><div><span>Previous reports</span><strong>{blocked || incidentFailure ? "…" : previousTotal}</strong></div><small>Approved or closed</small></div>
    </section>

    {exportError && <Alert severity="error" onClose={() => setExportError("")}>{exportError}</Alert>}
    {workspace.ready && (identityFailure || incidentFailure) && !reportFailure && <Alert severity="warning"
      action={<button className="rr-text-button" onClick={() => setReload(value => value + 1)}>Retry</button>}>
      {incidentFailure ? "Incident details could not be loaded. Folder status may be incomplete and review actions are disabled." : "Some respondent or patient details could not be loaded. Reports remain available using their saved identifiers."}
    </Alert>}

    <section className="rr-workspace" aria-label="Respondent reports">
      <div className="rr-workspace-heading">
        <nav className="rr-breadcrumb" aria-label="Report folders">
          {folderUid ? <><button className="rr-text-button" onClick={allFolders}><ArrowBackRounded fontSize="small" /> All respondents</button><ChevronRightRounded fontSize="small" /><span>{folder?.respondent.name || "Respondent folder"}</span></>
            : <><FolderOpenOutlined /><h2>Responders Record</h2><span className="rr-count">{blocked ? "…" : workspace.folders.length}</span></>}
        </nav>
        <span className="rr-live-label"><i className={`rr-dot ${blocked || identityFailure || incidentFailure ? "" : "rr-dot-live"}`} />{!workspace.ready ? "Connecting" : reportFailure || identityFailure || incidentFailure ? "Connection needs attention" : "Live updates"}</span>
      </div>

      {workspace.ready && folder && !reportFailure && <div className="rr-folder-header">
        <Avatar src={folder.respondent.photo || undefined} alt="" sx={{ width: 52, height: 52, bgcolor: "#F2F4F7", color: "#52647B", fontSize: 18 }}>{initials(folder.respondent.name)}</Avatar>
        <div><h2>{folder.respondent.name}</h2><p>{folder.respondent.position}{folder.respondent.email ? ` · ${folder.respondent.email}` : ""}</p></div>
        <span className="rr-folder-report-total"><strong>{folder.reports.length}</strong> {folder.reports.length === 1 ? "report" : "reports"}</span>
      </div>}

      {!blocked && (!folderUid || folder) && <>
        {folder && <div className="rr-tabs" role="group" aria-label="Choose report folder">
          {([{ id: "new", label: "New reports", count: folder.newCount, icon: <InboxOutlined fontSize="small" /> },
            { id: "previous", label: "Previous reports", count: folder.previousCount, icon: <HistoryRounded fontSize="small" /> },
            { id: "all", label: "All reports", count: folder.reports.length, icon: <DescriptionOutlined fontSize="small" /> }] as const)
            .map(tab => <button key={tab.id} type="button" className={`rr-tab ${view === tab.id ? "is-active" : ""}`} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}>
              {tab.icon}{tab.label}<span>{tab.count}</span></button>)}
        </div>}
        <div className="rr-toolbar"><div className="rr-search"><SearchRounded fontSize="small" />
          <input aria-label={folder ? "Search reports" : "Search respondents"} placeholder={folder ? "Search patient, incident or report details" : "Search responders by name or email"} value={query} onChange={event => setQuery(event.target.value)} />
          {query && <button className="rr-icon-button" onClick={() => setQuery("")} aria-label="Clear search"><CloseRounded fontSize="small" /></button>}
        </div><select className="rr-sort" aria-label="Sort reports or folders" value={sort} onChange={event => setSort(event.target.value)}>
          <option value="recent">{folder ? "Newest first" : "Recent activity"}</option>
          {folder ? <option value="oldest">Oldest first</option> : <option value="name">Name A to Z</option>}
        </select></div>
      </>}

      {!workspace.ready ? <div className="rr-empty" role="status"><CircularProgress size={30} /><h3>Loading responders record </h3><p>Getting reports and their linked profiles.</p></div>
        : reportFailure ? <div className="rr-empty" role="alert"><span className="rr-empty-symbol"><DescriptionOutlined /></span><h3>Reports could not be loaded</h3><p>Check your connection and administrator access, then try again.</p><button className="rr-button" onClick={() => setReload(value => value + 1)}><RefreshRounded fontSize="small" /> Try again</button></div>
        : folderUid && !folder ? <div className="rr-empty"><FolderOutlined /><h3>This folder is unavailable</h3><p>The respondent may no longer have an account or submitted report.</p><button className="rr-button" onClick={allFolders}>Back to responders record</button></div>
        : !totalVisible ? <div className="rr-empty"><span className="rr-empty-symbol">{folder && view === "new" ? <CheckCircleOutlineRounded /> : <FolderOpenOutlined />}</span>
          <h3>{query ? "No matching results" : folder ? view === "new" ? "No new reports" : view === "previous" ? "No previous reports yet" : "No reports submitted yet" : "No responders record yet"}</h3>
          <p>{query ? "Try another name, patient or incident ID." : folder ? view === "new" ? "New submissions awaiting a decision will appear here." : "Reports are organized automatically when they are submitted." : "Registered respondents and submitted reports will appear here automatically."}</p>
          {query ? <button className="rr-button" onClick={() => setQuery("")}>Clear search</button> : folder && view !== "all" && folder.reports.length > 0 ? <button className="rr-button" onClick={() => setView("all")}>View all reports</button> : null}
        </div>
        : folder ? <div className="rr-table-container"><table className="rr-report-table"><thead><tr><th>Patient / incident</th><th>Report type</th><th>Submitted</th><th>Case review</th><th><span className="rr-sr-only">Open report</span></th></tr></thead>
          <tbody>{visibleReports.slice(start, start + PAGE_SIZE).map(entry => <ReportRow key={entry.key} entry={entry} onOpen={() => setSelectedKey(entry.key)} />)}</tbody></table></div>
        : <div className="rr-folder-grid">{visibleFolders.slice(start, start + PAGE_SIZE).map(item => <FolderCard key={item.respondent.uid} folder={item} onOpen={() => openFolder(item)} />)}</div>}

      {!blocked && totalVisible > 0 && <footer className="rr-workspace-footer"><span>Showing {start + 1} to {Math.min(start + PAGE_SIZE, totalVisible)} of {totalVisible} {folder ? "reports" : "folders"}</span>
        {pageCount > 1 ? <div className="rr-pagination"><button className="rr-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage + 1} / {pageCount}</span><button className="rr-button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div>
          : <span className="rr-footer-note">{folder ? "Individual and final submissions are listed separately." : "One folder for each responders."}</span>}
      </footer>}
    </section>

    <RescueReportDetails entry={selectedEntry} caseEntries={caseEntries} onOpen={setSelectedKey}
      onClose={() => setSelectedKey(null)} readOnly={incidentFailure}
      onSaved={message => { setSelectedKey(null); setNotice(message); }} />
    <Snackbar open={Boolean(notice)} autoHideDuration={5500} onClose={() => setNotice("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
      <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>
    </Snackbar>
  </div>;
}
