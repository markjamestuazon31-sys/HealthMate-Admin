import { useEffect, useMemo, useState } from "react";
import { AddRounded, DownloadRounded, EditOutlined, ElderlyRounded, FamilyRestroomRounded, FilterAltOutlined, HomeWorkRounded, PeopleAltOutlined, PrintOutlined, RefreshRounded, SearchRounded, VisibilityOutlined } from "@mui/icons-material";
import { Alert, Avatar, Box, Button, Chip, Collapse, IconButton, InputAdornment, LinearProgress, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import type { Household } from "../types";
import { BUNUANAN_PUROKS } from "../config/bunuananServiceArea";
import { AGE_BRACKETS, ageOn, currentInhabitants, DEFAULT_FILTERS, familyCount, inSector, matchesPerson, personLocation, SECTORS, socialLabels, todayInManila, type RegistryFilters, type RegistryInhabitant } from "../services/inhabitantModel";
import { listenHouseholds, listenInhabitants, type HouseholdInput, type InhabitantInput } from "../services/inhabitantService";
import HouseholdWizard from "../components/inhabitants/HouseholdWizard";
import HouseholdProfileDialog from "../components/inhabitants/HouseholdProfileDialog";
import InhabitantProfileDialog from "../components/inhabitants/InhabitantProfileDialog";
import RegistryEditor from "../components/inhabitants/RegistryEditor";
import PopulationSummary from "../components/inhabitants/PopulationSummary";
import { blankInhabitant } from "../components/inhabitants/ProfileFields";
import { downloadCsv, householdsRows, inhabitantsRows, printRegistryDirectory } from "../utils/inhabitantExport";
import "../styles/inhabitants.css";

type Editor = { kind: "household"; initial: HouseholdInput } | { kind: "inhabitant"; initial: InhabitantInput };
function StatusChip({ status }: { status?: string }) {
  return <Chip size="small" variant="outlined" className="ip-status" label={status || "Not recorded"} color={status === "active" ? "success" : status === "deceased" ? "default" : "warning"} />;
}
export default function InhabitantsProfiling() {
  const [households, setHouseholds] = useState<Household[]>([]), [inhabitants, setInhabitants] = useState<RegistryInhabitant[]>([]);
  const [loaded, setLoaded] = useState({ households: false, inhabitants: false }), [error, setError] = useState("");
  const [printError, setPrintError] = useState("");
  const [retry, setRetry] = useState(0), [notice, setNotice] = useState("");
  const [tab, setTab] = useState(0), [filters, setFilters] = useState<RegistryFilters>({ ...DEFAULT_FILTERS }), [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(0), [pageSize, setPageSize] = useState(10);
  const [wizard, setWizard] = useState(false), [editor, setEditor] = useState<Editor | null>(null);
  const [householdId, setHouseholdId] = useState(""), [personId, setPersonId] = useState("");
  const [date, setDate] = useState(todayInManila);
  useEffect(() => {
    const timer = window.setInterval(() => setDate(todayInManila()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true; setLoaded({ households: false, inhabitants: false }); setError("");
    const failed = (e: Error) => { if (active) setError(`Unable to load the registry: ${e.message}`); };
    const stops = [
      listenHouseholds(items => { if (active) { setHouseholds(items); setLoaded(l => ({ ...l, households: true })); } }, failed),
      listenInhabitants(items => { if (active) { setInhabitants(items); setLoaded(l => ({ ...l, inhabitants: true })); } }, failed),
    ];
    return () => { active = false; stops.forEach(stop => stop()); };
  }, [retry]);
  const ready = loaded.households && loaded.inhabitants && !error;
  const byId = useMemo(() => new Map(households.map(h => [h.id, h])), [households]);
  const members = useMemo(() => {
    const map = new Map<string, RegistryInhabitant[]>();
    inhabitants.forEach(person => { const group = map.get(person.householdId) || []; group.push(person); map.set(person.householdId, group); });
    return map;
  }, [inhabitants]);
  const current = useMemo(() => currentInhabitants(inhabitants, households), [inhabitants, households]);
  const filteredPeople = useMemo(() => inhabitants.filter(p => matchesPerson(p, byId.get(p.householdId), filters, date)).sort((a, b) =>
    filters.sort === "updated" ? (b.updatedAt || 0) - (a.updatedAt || 0) || a.fullName.localeCompare(b.fullName)
      : filters.sort === "oldest" ? (ageOn(b.birthDate, date) ?? -1) - (ageOn(a.birthDate, date) ?? -1) || a.fullName.localeCompare(b.fullName)
      : a.fullName.localeCompare(b.fullName)), [inhabitants, byId, filters, date]);
  const filteredHouseholds = useMemo(() => households.filter(h => {
    const terms = filters.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const search = [h.householdName, h.id, h.householdHeadName, h.address, h.purokId, h.primaryContact, h.secondaryContact,
      ...(members.get(h.id) || []).map(p => p.fullName)].join(" ").toLowerCase();
    return terms.every(t => search.includes(t)) && (!filters.purok || h.purokId === filters.purok) && (!filters.status || h.status === filters.status);
  }).sort((a, b) => filters.sort === "updated" ? (b.updatedAt || 0) - (a.updatedAt || 0) || a.householdName.localeCompare(b.householdName) : a.householdName.localeCompare(b.householdName)), [households, members, filters]);
  const count = tab === 0 ? filteredPeople.length : filteredHouseholds.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(count / pageSize) - 1));
  const start = safePage * pageSize;
  function changeFilter(key: keyof RegistryFilters, value: string) { setFilters(f => ({ ...f, [key]: value })); setPage(0); }
  function reset() { setFilters({ ...DEFAULT_FILTERS }); setPage(0); }
  function addPerson(id: string) { if (!byId.has(id)) return; setHouseholdId(""); setEditor({ kind: "inhabitant", initial: blankInhabitant(id) }); }
  function editPerson(person: RegistryInhabitant) {
    setPersonId(""); setHouseholdId(""); setEditor({ kind: "inhabitant", initial: { ...person, expectedUpdatedAt: Number(person.updatedAt || 0) } });
  }
  function editHousehold(household: Household) {
    setHouseholdId(""); setEditor({ kind: "household", initial: { ...household, expectedUpdatedAt: Number(household.updatedAt || 0) } });
  }
  const selectedHousehold = byId.get(householdId), selectedPerson = inhabitants.find(p => p.id === personId);
  const chips: { key: keyof RegistryFilters; label: string }[] = [
    ...(filters.search ? [{ key: "search" as const, label: `Search: ${filters.search}` }] : []),
    ...(filters.purok ? [{ key: "purok" as const, label: filters.purok }] : []),
    ...(filters.status ? [{ key: "status" as const, label: `Status: ${filters.status}` }] : []),
    ...(filters.sex ? [{ key: "sex" as const, label: `Sex: ${filters.sex === "unknown" ? "Other / not recorded" : filters.sex}` }] : []),
    ...(filters.age ? [{ key: "age" as const, label: AGE_BRACKETS.find(b => b.id === filters.age)?.label || "Age not recorded" }] : []),
    ...(filters.sector ? [{ key: "sector" as const, label: SECTORS.find(([id]) => id === filters.sector)?.[1] || filters.sector }] : []),
  ];
  const stats = [
    { label: "Current inhabitants", value: current.length, note: "Active community members", icon: <PeopleAltOutlined /> },
    { label: "Active households", value: households.filter(h => h.status === "active").length, note: "Registered residences", icon: <HomeWorkRounded /> },
    { label: "Recorded families", value: familyCount(current), note: "Families with an assigned number", icon: <FamilyRestroomRounded /> },
    { label: "Senior citizens", value: current.filter(p => inSector(p, "senior", date)).length, note: "Age 60 and above", icon: <ElderlyRounded /> },
  ];
  return <div className="ip-page">
    <header className="ip-header"><div><div className="ip-eyebrow">BARANGAY MASTERLIST</div><Typography variant="h4" component="h1">Inhabitants profiling</Typography><Typography color="text.secondary" sx={{ mt: 1, maxWidth: 650 }}>A complete view of your community. Manage household records, family members, and population information.</Typography><div className="ip-location">Barangay Bunuanan <span>·</span> Catbalogan City</div></div>
      <div className="ip-header-actions"><Button variant="contained" startIcon={<HomeWorkRounded />} disabled={!ready} onClick={() => setWizard(true)}>Register household</Button></div>
    </header>
    {printError && <Alert severity="warning" onClose={() => setPrintError("")}>{printError}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    {error && <Alert severity="error" action={<Button color="inherit" startIcon={<RefreshRounded />} onClick={() => setRetry(v => v + 1)}>Retry</Button>}>{error}</Alert>}
    <div className="ip-stats" aria-busy={!ready}>{stats.map((stat, index) => <div className={`ip-stat ip-stat-${index}`} key={stat.label}><span className="ip-stat-icon">{stat.icon}</span><div><span className="ip-stat-label">{stat.label}</span><strong>{ready ? stat.value.toLocaleString() : "—"}</strong><span className="ip-stat-note">{stat.note}</span></div></div>)}</div>
    <section className="ip-workspace">
      <div className="ip-tabs"><Tabs value={tab} variant="scrollable" scrollButtons="auto" aria-label="Registry views" onChange={(_, value: number) => { setTab(value); setFilters(f => ({ ...DEFAULT_FILTERS, purok: f.purok })); setPage(0); setAdvanced(false); }}>
        <Tab id="ip-tab-0" aria-controls="ip-panel" label="Inhabitants" icon={<PeopleAltOutlined />} iconPosition="start" /><Tab id="ip-tab-1" aria-controls="ip-panel" label="Households" icon={<HomeWorkRounded />} iconPosition="start" /><Tab id="ip-tab-2" aria-controls="ip-panel" label="Population summary" icon={<FamilyRestroomRounded />} iconPosition="start" />
      </Tabs><span className="ip-live-note">As of {date}</span></div>
      {!ready && !error && <Box sx={{ p: 3 }} role="status"><LinearProgress /><Typography sx={{ mt: 2 }} color="text.secondary">Loading household and inhabitant records…</Typography></Box>}
      {ready && <div id="ip-panel" role="tabpanel" aria-labelledby={`ip-tab-${tab}`}>
        {tab === 2 ? <PopulationSummary inhabitants={current} households={households} date={date} /> : <>
          <div className="ip-filter-area">
            <div className="ip-primary-filters"><TextField fullWidth size="small" label={tab === 0 ? "Search inhabitants" : "Search households"} placeholder="Name, address, mobile or record ID" value={filters.search} onChange={e => changeFilter("search", e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />
              <TextField select size="small" label="Purok" value={filters.purok} onChange={e => changeFilter("purok", e.target.value)}><MenuItem value="">All Puroks</MenuItem>{BUNUANAN_PUROKS.map(p => <MenuItem value={p} key={p}>{p}</MenuItem>)}</TextField>
              <TextField select size="small" label="Record status" value={filters.status} onChange={e => changeFilter("status", e.target.value)}><MenuItem value="">All statuses</MenuItem>{(tab === 0 ? ["active", "relocated", "deceased"] : ["active", "inactive", "relocated"]).map(s => <MenuItem value={s} key={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}</TextField>
              <Button variant={advanced ? "contained" : "outlined"} startIcon={<FilterAltOutlined />} onClick={() => setAdvanced(v => !v)} aria-expanded={advanced} aria-controls="ip-more-filters">{tab === 0 ? "More filters" : "Sort"}</Button>
            </div>
            <Collapse in={advanced}><div id="ip-more-filters" className="ip-more-filters">
              {tab === 0 && <><TextField select size="small" label="Sex" value={filters.sex} onChange={e => changeFilter("sex", e.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="male">Male</MenuItem><MenuItem value="female">Female</MenuItem><MenuItem value="unknown">Other / not recorded</MenuItem></TextField>
                <TextField select size="small" label="Age bracket" value={filters.age} onChange={e => changeFilter("age", e.target.value)}><MenuItem value="">All ages</MenuItem>{AGE_BRACKETS.map(b => <MenuItem value={b.id} key={b.id}>{b.label}</MenuItem>)}<MenuItem value="unknown">Age not recorded</MenuItem></TextField>
                <TextField select size="small" label="Population sector" value={filters.sector} onChange={e => changeFilter("sector", e.target.value)}><MenuItem value="">All sectors</MenuItem>{SECTORS.map(([id, label]) => <MenuItem value={id} key={id}>{label}</MenuItem>)}</TextField></>}
              <TextField select size="small" label="Sort by" value={filters.sort} onChange={e => changeFilter("sort", e.target.value)}><MenuItem value="name">Name A–Z</MenuItem><MenuItem value="updated">Recently updated</MenuItem>{tab === 0 && <MenuItem value="oldest">Oldest age first</MenuItem>}</TextField>
            </div></Collapse>
            <div className="ip-filter-bottom"><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap">{chips.map(c => <Chip key={c.key} size="small" label={c.label} onDelete={() => changeFilter(c.key, "")} />)}<Button size="small" color="inherit" onClick={reset}>Reset filters</Button></Stack><Typography variant="caption" color="text.secondary">{filters.sort === "updated" ? "Recently updated" : filters.sort === "oldest" ? "Oldest age first" : "Name A–Z"}</Typography></div>
          </div>
          <div className="ip-results-toolbar">
            <div><Typography component="h2" fontWeight={700}>{tab === 0 ? "Inhabitant masterlist" : "Household directory"}</Typography><Typography variant="caption" color="text.secondary">{count.toLocaleString()} of {(tab === 0 ? inhabitants.length : households.length).toLocaleString()} records match your filters</Typography></div>
            <div className="ip-print-actions">
              <Button startIcon={<DownloadRounded />} disabled={!count} onClick={() => downloadCsv(`Bunuanan_${tab === 0 ? "Inhabitants" : "Households"}_${date}.csv`, tab === 0 ? inhabitantsRows(filteredPeople, households, date) : householdsRows(filteredHouseholds, inhabitants))}>Export CSV</Button>
              <Button variant="outlined" startIcon={<PrintOutlined />} disabled={!count} onClick={() => setPrintError(printRegistryDirectory(tab === 0 ? "inhabitants" : "households", tab === 0 ? filteredPeople : inhabitants, tab === 0 ? households : filteredHouseholds, date, [...chips.map(c => c.label), filters.sort === "updated" ? "Recently updated" : filters.sort === "oldest" ? "Oldest age first" : "Name A–Z"]) ? "" : "Allow popups for this page, then select Print directory again.")}>Print directory</Button>
            </div>
          </div>
          {count === 0 ? <div className="ip-empty"><SearchRounded /><Typography component="h3" fontWeight={800}>No {tab === 0 ? "inhabitants" : "households"} found</Typography><Typography color="text.secondary">{(tab === 0 ? inhabitants.length : households.length) ? "Try another name or adjust your filters." : "Start building the masterlist by registering your first record."}</Typography><Button variant="outlined" onClick={(tab === 0 ? inhabitants.length : households.length) ? reset : () => setWizard(true)}>{(tab === 0 ? inhabitants.length : households.length) ? "Reset filters" : "Register household"}</Button></div> : <TableContainer><Table className="ip-table" aria-label={tab === 0 ? "Inhabitant masterlist" : "Household directory"}>
            {tab === 0 ? <><TableHead><TableRow><TableCell>Inhabitant</TableCell><TableCell>Household & location</TableCell><TableCell>Contact</TableCell><TableCell>Sector</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{filteredPeople.slice(start, start + pageSize).map(p => {
              const h = byId.get(p.householdId), location = personLocation(p, h), age = ageOn(p.birthDate, date), labels = socialLabels(p, date);
              return <TableRow key={p.id} hover><TableCell><Stack direction="row" spacing={1.25} alignItems="center"><Avatar className="ip-avatar">{p.fullName.split(/\s+/).filter(Boolean).slice(0,2).map(n => n[0]).join("")}</Avatar><Box><Button className="ip-record-name" onClick={() => setPersonId(p.id)}>{p.fullName}</Button><Typography variant="caption" display="block" color="text.secondary">{age === null ? "Age not recorded" : `${age} yrs`} · {p.sex || "Sex not recorded"}{p.isHouseholdHead ? " · Head" : ""}</Typography></Box></Stack></TableCell>
                <TableCell>{h ? <Button className="ip-household-link" onClick={() => setHouseholdId(h.id)}>{h.householdName}</Button> : <Typography variant="body2" color="text.secondary">Household not assigned</Typography>}<Typography variant="caption" display="block" color="text.secondary">{location.purokId || "Purok not recorded"} · {location.address || "Address not recorded"}</Typography></TableCell>
                <TableCell><Typography variant="body2">{p.phone || "—"}</Typography></TableCell><TableCell><Stack direction="row" spacing={.5} flexWrap="wrap" useFlexGap>{labels.slice(0,2).map(label => <Chip className="ip-sector-chip" size="small" key={label} label={label} />)}{labels.length > 2 && <Tooltip title={labels.slice(2).join(", ")}><Chip tabIndex={0} size="small" label={`+${labels.length-2}`} /></Tooltip>}{!labels.length && <Typography variant="caption" color="text.secondary">No recorded category</Typography>}</Stack></TableCell><TableCell><StatusChip status={p.status} /></TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}><Tooltip title="View profile"><IconButton aria-label={`View ${p.fullName}`} onClick={() => setPersonId(p.id)}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip><Tooltip title="Edit profile"><IconButton aria-label={`Edit ${p.fullName}`} onClick={() => editPerson(p)}><EditOutlined fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>;
            })}</TableBody></> : <><TableHead><TableRow><TableCell>Household</TableCell><TableCell>Location</TableCell><TableCell>Household head</TableCell><TableCell>Contact</TableCell><TableCell>Members</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{filteredHouseholds.slice(start,start + pageSize).map(h => {
              const group = members.get(h.id) || [];
              return <TableRow key={h.id} hover><TableCell><Button className="ip-record-name" onClick={() => setHouseholdId(h.id)}>{h.householdName}</Button><Typography variant="caption" display="block" color="text.secondary">{h.householdType || "Type not recorded"}</Typography></TableCell><TableCell><Typography variant="body2" fontWeight={700}>{h.purokId}</Typography><Typography variant="caption" color="text.secondary">{h.address}</Typography></TableCell><TableCell>{h.householdHeadName || "Not assigned"}</TableCell><TableCell>{h.primaryContact || "—"}</TableCell><TableCell><Typography fontWeight={700}>{group.length}</Typography><Typography variant="caption" color="text.secondary">{group.filter(p => p.status === "active").length} active</Typography></TableCell><TableCell><StatusChip status={h.status} /></TableCell><TableCell align="right" sx={{ whiteSpace: "nowrap" }}><Tooltip title="View household"><IconButton aria-label={`View ${h.householdName}`} onClick={() => setHouseholdId(h.id)}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip><Tooltip title="Add member"><IconButton aria-label={`Add member to ${h.householdName}`} onClick={() => addPerson(h.id)}><AddRounded fontSize="small" /></IconButton></Tooltip><Tooltip title="Edit household"><IconButton aria-label={`Edit ${h.householdName}`} onClick={() => editHousehold(h)}><EditOutlined fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>;
            })}</TableBody></>}
          </Table></TableContainer>}
          <TablePagination component="div" count={count} page={safePage} onPageChange={(_, next) => setPage(next)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10,25,50]} />
        </>}
      </div>}
    </section>
    {wizard && <HouseholdWizard open onClose={() => setWizard(false)} onSaved={id => { setWizard(false); setHouseholdId(id); setNotice("Household and family members registered."); }} />}
    {editor && (editor.kind === "household" ? <RegistryEditor key={`household-${editor.initial.id}`} {...editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Household updated."); }} /> : <RegistryEditor key={`inhabitant-${editor.initial.id || "new"}`} {...editor} households={households} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Inhabitant profile saved."); }} />)}
    {selectedHousehold && <HouseholdProfileDialog household={selectedHousehold} members={members.get(selectedHousehold.id) || []} onClose={() => setHouseholdId("")} onEditHousehold={editHousehold} onEditMember={editPerson} onAddMember={addPerson} onViewMember={person => { setHouseholdId(""); setPersonId(person.id); }} />}
    {selectedPerson && <InhabitantProfileDialog person={selectedPerson} household={byId.get(selectedPerson.householdId)} onClose={() => setPersonId("")} onEdit={() => editPerson(selectedPerson)} />}
  </div>;
}
