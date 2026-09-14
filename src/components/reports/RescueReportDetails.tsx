import { useEffect, useState } from "react";
import { Alert, CircularProgress, Dialog, useMediaQuery } from "@mui/material";
import { CloseRounded, DescriptionOutlined, OpenInNewRounded, PrintRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { RescueReviewStatus } from "../../types";
import { closeReviewedIncident, reviewFinalReport } from "../../services/rescueReportService";
import {
  reportCaseStatus, reportDate, reportLabel, type RespondentReportEntry,
} from "../../services/rescueReportModel";
import { printRescueReport } from "../../utils/rescueReportExport";

type ReviewDecision = Exclude<RescueReviewStatus, "PENDING_REVIEW">;
interface Props {
  entry: RespondentReportEntry | null;
  caseEntries: RespondentReportEntry[];
  onOpen: (key: string) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
  readOnly?: boolean;
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="rr-field"><dt>{label}</dt><dd>{children || "Not recorded"}</dd></div>;
}

export default function RescueReportDetails({ entry, caseEntries, onOpen, onClose, onSaved, readOnly }: Props) {
  const fullScreen = useMediaQuery("(max-width: 700px)");
  const [decision, setDecision] = useState<ReviewDecision>("APPROVED");
  const [notes, setNotes] = useState("");
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const final = entry?.caseReport.final;
  const loadCurrent = () => {
    setDecision(final?.reviewStatus && final.reviewStatus !== "PENDING_REVIEW" ? final.reviewStatus : "APPROVED");
    setNotes(final?.reviewNotes || "");
    setBaseline(final?.sourceRevision || "");
    setError(""); setConfirmClose(false);
  };
  // A live update must not silently replace an administrator's unfinished note.
  useEffect(() => { loadCurrent(); }, [entry?.key]);
  const changed = Boolean(final && baseline && final.sourceRevision !== baseline);
  const terminal = entry?.caseReport.emergency?.status === "CLOSED" || entry?.caseReport.emergency?.status === "CANCELLED";
  const canReview = entry?.kind === "final" && Boolean(final) && Boolean(entry.caseReport.emergency) && !terminal && !readOnly;
  const canClose = canReview && final?.reviewStatus === "APPROVED" && entry?.caseReport.emergency?.status === "ADMIN_REVIEWED";
  const finalEntry = caseEntries.find(item => item.kind === "final");
  const status = entry ? reportCaseStatus(entry.caseReport) : null;

  async function saveDecision() {
    if (!entry || !final || changed || busy || !canReview) return;
    setBusy(true); setError("");
    try {
      await reviewFinalReport(entry.incidentId, decision, notes, baseline);
      onSaved("Review decision saved. The respondent folders have been updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the review."); }
    finally { setBusy(false); }
  }
  async function closeIncident() {
    if (!entry || !canClose || changed || busy) return;
    setBusy(true); setError("");
    try {
      await closeReviewedIncident(entry.incidentId, baseline);
      onSaved("Incident closed. Its reports are kept in Previous reports.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to close the incident."); }
    finally { setBusy(false); }
  }
  function print() {
    if (!entry) return;
    try { printRescueReport(entry); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open the print view."); }
  }

  return <Dialog open={Boolean(entry)} onClose={() => { if (!busy) onClose(); }}
    maxWidth="lg" fullWidth fullScreen={fullScreen} aria-labelledby="rr-report-title"
    PaperProps={{ className: "rr-dialog", sx: { borderRadius: fullScreen ? 0 : "16px", maxWidth: "1080px" } }}>
    {entry && <>
      <div className="rr-dialog-header">
        <div className="rr-dialog-heading"><span className="rr-document-symbol"><DescriptionOutlined /></span>
          <div><p className="rr-eyebrow">{entry.kind === "final" ? "Coordinator final report" : "Individual respondent report"}</p>
            <h2 id="rr-report-title">{entry.patient}</h2></div>
        </div>
        <button type="button" className="rr-icon-button" onClick={onClose} disabled={busy} aria-label="Close report"><CloseRounded /></button>
      </div>
      <div className="rr-dialog-body">
        {error && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{error}</Alert>}
        {changed && <Alert severity="warning" sx={{ mb: 2 }} action={<button className="rr-text-button" onClick={loadCurrent} disabled={busy}>Load latest</button>}>
          This report or its review has changed. Load the latest version before saving.
        </Alert>}
        {readOnly && <Alert severity="warning" sx={{ mb: 2 }}>Incident data is unavailable. Review actions are temporarily disabled.</Alert>}
        {!entry.caseReport.emergency && !readOnly && <Alert severity="info" sx={{ mb: 2 }}>The original incident is unavailable. This saved report can still be viewed and printed.</Alert>}
        <div className="rr-detail-layout">
          <main className="rr-detail-main">
            <section className="rr-detail-section">
              <div className="rr-section-heading"><h3>Report information</h3><span className={`rr-badge rr-badge-${status?.tone}`}>{status?.label}</span></div>
              <dl className="rr-detail-grid">
                <Field label="Submitted by">{entry.respondent.name}</Field>
                <Field label="Submitted on">{reportDate(entry.submittedAt)}</Field>
                <Field label={entry.kind === "final" ? "Final classification" : "Recommended classification"}>{reportLabel(entry.classification)}</Field>
                <Field label="Response role">{entry.kind === "final" ? "Coordinator" : reportLabel(entry.caseReport.responders[entry.ownerUid]?.teamRole)}</Field>
                <Field label="Recorded arrival">{entry.narrative.arrivalAt ? reportDate(entry.narrative.arrivalAt) : "Not recorded"}</Field>
                <Field label="Recorded completion">{entry.narrative.completedAt ? reportDate(entry.narrative.completedAt) : "Not recorded"}</Field>
              </dl>
            </section>
            {entry.kind === "final" && <section className="rr-detail-section"><h3>Final report summary</h3><p className="rr-narrative">{entry.summary || "No summary recorded."}</p></section>}
            <section className="rr-detail-section">
              <h3>Response details</h3>
              <dl className="rr-narrative-fields">
                <Field label="Observed condition">{entry.narrative.observedCondition}</Field>
                <Field label="Actions performed">{entry.narrative.actionsPerformed}</Field>
                <Field label="Agencies contacted">{entry.narrative.agenciesContacted}</Field>
                <Field label="Transport destination">{entry.narrative.transportDestination}</Field>
                <Field label="Additional notes">{entry.narrative.notes}</Field>
              </dl>
            </section>
            {final?.reviewedAt && <section className="rr-detail-section rr-saved-review">
              <div className="rr-section-heading"><h3>Last administrative review</h3><span className="rr-muted">{reportDate(final.reviewedAt)}</span></div>
              <p className="rr-narrative">{final.reviewNotes || "No review notes recorded."}</p>
            </section>}
            {canReview && <section className="rr-detail-section rr-review-section">
              <h3>Administrative decision</h3>
              <form onSubmit={event => { event.preventDefault(); void saveDecision(); }}>
                <label className="rr-input-label" htmlFor="rr-decision">Decision</label>
                <select id="rr-decision" className="rr-form-control" value={decision} disabled={busy || changed} onChange={event => setDecision(event.target.value as ReviewDecision)}>
                  <option value="APPROVED">Approve final report</option>
                  <option value="RETURNED_FOR_CORRECTION">Return for correction</option>
                  <option value="INVESTIGATION">Refer for investigation</option>
                </select>
                <label className="rr-input-label" htmlFor="rr-notes">Review notes {decision === "APPROVED" ? <span className="rr-muted">(optional)</span> : <span>(required)</span>}</label>
                <textarea id="rr-notes" className="rr-form-control" rows={4} maxLength={5000}
                  placeholder="Record your decision or explain what needs attention."
                  required={decision !== "APPROVED"} value={notes} onChange={event => setNotes(event.target.value)} disabled={busy || changed} />
                <div className="rr-review-actions"><span className="rr-muted">{notes.length.toLocaleString()} / 5,000</span>
                  <button className="rr-button rr-button-primary" type="submit" disabled={busy || changed || (decision !== "APPROVED" && !notes.trim())}>
                    {busy ? <CircularProgress size={16} color="inherit" /> : null} Save decision
                  </button>
                </div>
              </form>
            </section>}
            {entry.kind === "individual" && <div className="rr-callout">
              <p>Administrative decisions are recorded on the coordinator’s final report.</p>
              {finalEntry && <button className="rr-text-button" onClick={() => onOpen(finalEntry.key)} disabled={busy}>Open final report <OpenInNewRounded fontSize="small" /></button>}
            </div>}
          </main>
          <aside className="rr-detail-aside" aria-label="Case details and related reports">
            <section className="rr-side-section"><h3>Incident</h3>
              <strong>{entry.patient}</strong><p className="rr-muted">{entry.caseReport.emergency?.type || "Emergency incident"}</p>
              <p className="rr-incident-id">{entry.incidentId}</p>
              {entry.caseReport.emergency && <Link to={`/emergencies/${encodeURIComponent(entry.incidentId)}`} className="rr-text-button" onClick={onClose}>Open incident <OpenInNewRounded fontSize="small" /></Link>}
            </section>
            <section className="rr-side-section"><h3>Reports in this case <span>{caseEntries.length}</span></h3>
              <div className="rr-case-report-links">{caseEntries.map(item => <button key={item.key} type="button"
                className={`rr-related-report ${item.key === entry.key ? "is-selected" : ""}`}
                onClick={() => onOpen(item.key)} disabled={busy} aria-current={item.key === entry.key ? "true" : undefined}>
                <DescriptionOutlined fontSize="small" /><span><strong>{item.respondent.name}</strong><small>{item.kind === "final" ? "Final report" : "Individual report"}</small></span>
              </button>)}</div>
            </section>
            {canClose && <section className="rr-side-section rr-close-section"><h3>Close this incident</h3>
              <p>The final report is approved. Closing keeps all submissions in Previous reports.</p>
              {confirmClose ? <><p><strong>Confirm that this case is complete.</strong></p>
                <button className="rr-button rr-button-primary" onClick={() => void closeIncident()} disabled={busy || changed}>Confirm close</button>
                <button className="rr-text-button" onClick={() => setConfirmClose(false)} disabled={busy}>Keep open</button>
              </> : <button className="rr-button" onClick={() => setConfirmClose(true)} disabled={busy || changed}>Close incident</button>}
            </section>}
          </aside>
        </div>
      </div>
      <div className="rr-dialog-footer"><span className="rr-muted">Dates and times shown in Philippine time.</span>
        <div className="rr-button-group"><button type="button" className="rr-button" onClick={print} disabled={busy}><PrintRounded fontSize="small" /> Print report</button>
          <button type="button" className="rr-button" onClick={onClose} disabled={busy}>Done</button></div>
      </div>
    </>}
  </Dialog>;
}
