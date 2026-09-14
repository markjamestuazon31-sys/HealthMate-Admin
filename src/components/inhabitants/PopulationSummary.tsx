import { useState } from "react";
import { DownloadRounded, PrintOutlined } from "@mui/icons-material";
import { Alert, Box, Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import type { Household } from "../../types";
import { BUNUANAN_PUROKS } from "../../config/bunuananServiceArea";
import { ageOn, familyCount, personLocation, populationSummary, SOCIAL_FIELDS, type PopulationRow, type RegistryInhabitant } from "../../services/inhabitantModel";
import { downloadCsv, printPopulationSummary, summaryRows } from "../../utils/inhabitantExport";

function SummaryTable({ title, rows }: { title: string; rows: PopulationRow[] }) {
  return <section className="ip-summary-section"><Typography component="h3" fontWeight={800}>{title}</Typography><TableContainer><Table size="small" aria-label={title}>
    <TableHead><TableRow><TableCell>Indicators</TableCell><TableCell align="right">Male</TableCell><TableCell align="right">Female</TableCell><TableCell align="right">Other / not recorded</TableCell><TableCell align="right">Total</TableCell><TableCell>Remarks</TableCell></TableRow></TableHead>
    <TableBody>{rows.map(row => <TableRow key={row.label}><TableCell component="th" scope="row">{row.label}</TableCell><TableCell align="right">{row.male}</TableCell><TableCell align="right">{row.female}</TableCell><TableCell align="right">{row.other}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{row.total}</TableCell><TableCell sx={{ color: "text.secondary" }}>{row.other ? "Includes other / unrecorded sex" : "—"}</TableCell></TableRow>)}</TableBody>
  </Table></TableContainer></section>;
}
export default function PopulationSummary({ inhabitants, households, date }: { inhabitants: RegistryInhabitant[]; households: Household[]; date: string }) {
  const [purok, setPurok] = useState(""), [error, setError] = useState("");
  const byId = new Map(households.map(h => [h.id, h]));
  const people = inhabitants.filter(p => !purok || personLocation(p, byId.get(p.householdId)).purokId === purok);
  const scopedHouseholds = households.filter(h => h.status === "active" && (!purok || h.purokId === purok));
  const summary = populationSummary(people, date);
  const missingFamily = people.filter(p => !p.householdId || !p.familyNumber).length;
  const missing: [string, number][] = [
    ["Valid birthday", people.filter(p => ageOn(p.birthDate, date) === null).length],
    ["Male / female recorded", summary.total.other], ["Family assignment", missingFamily],
    ["Employment status", people.filter(p => !p.employmentStatus).length], ["School attendance", people.filter(p => !p.schoolAttendance).length],
    ["Citizenship", summary.citizenship[2].total],
    ...SOCIAL_FIELDS.map(([key, label]): [string, number] => [label, people.filter(p => typeof p[key] !== "boolean").length]),
  ];
  return <Box className="ip-summary">
    <div className="ip-summary-toolbar"><div><Typography variant="h6" component="h2" fontWeight={800}>Population monitoring summary</Typography><Typography variant="body2" color="text.secondary">RBI Form C indicators · Current registry as of {date}</Typography></div>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField select size="small" label="Summary Purok" value={purok} onChange={e => setPurok(e.target.value)} sx={{ minWidth: 160 }}><MenuItem value="">All Puroks</MenuItem>{BUNUANAN_PUROKS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}</TextField>
        <Button startIcon={<DownloadRounded />} variant="outlined" onClick={() => downloadCsv(`Bunuanan_Population_${date}.csv`, summaryRows(people, scopedHouseholds, date, purok))}>CSV</Button>
        <Button startIcon={<PrintOutlined />} variant="contained" onClick={() => setError(printPopulationSummary(people, scopedHouseholds, date, purok) ? "" : "Allow popups for this page, then select Print summary again.")}>Print summary</Button>
      </Stack>
    </div>
    {error && <Alert severity="warning" onClose={() => setError("")}>{error}</Alert>}
    <div className="ip-summary-totals"><div><span>Current inhabitants</span><strong>{people.length.toLocaleString()}</strong></div><div><span>Active households</span><strong>{scopedHouseholds.length.toLocaleString()}</strong></div><div><span>Recorded families</span><strong>{familyCount(people).toLocaleString()}</strong></div></div>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Includes active inhabitants in active households and active inhabitants awaiting household assignment. The summary uses its own Purok filter. Age is calculated today; this is a current register, not a historical census.</Typography>
    <SummaryTable title="Population by age bracket" rows={[...summary.ages, summary.total]} />
    <SummaryTable title="Population by sector" rows={summary.sectors} />
    <Typography variant="caption" color="text.secondary">Sector categories can overlap. Labor force includes recorded employed and unemployed inhabitants aged 15+. Blank social data is unrecorded, not “No”.</Typography>
    <div className="ip-summary-pair"><SummaryTable title="Civil status" rows={summary.civil} /><SummaryTable title="Citizenship" rows={summary.citizenship} /></div>
    <details className="ip-completeness"><summary>Data completeness · check unrecorded information</summary><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Family totals count distinct family numbers within each household. {missingFamily} inhabitant(s) have no recorded family assignment. Missing information is excluded from the relevant category counts.</Typography>
      <div className="ip-completeness-grid">{missing.map(([label, count]) => <div key={label}><span>{label}</span><strong>{count} missing</strong></div>)}</div>
    </details>
  </Box>;
}
