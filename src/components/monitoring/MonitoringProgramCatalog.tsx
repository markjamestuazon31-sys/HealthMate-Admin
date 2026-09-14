import { useRef, useState } from "react";
import { AddRounded, CloseRounded, EditOutlined, SearchRounded } from "@mui/icons-material";
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { PROGRAM_CATEGORIES, supportsScope, type MonitoringProgram } from "../../services/monitoringPrograms";
import { saveMonitoringProgram } from "../../services/monitoringProgramService";
import { monitoringKey } from "../../services/monitoringService";

export function MonitoringProgramSelect({programs, id, name, scope, onChange, disabled = false, allowCurrent = false}: {
  programs: MonitoringProgram[]; id?: string; name: string; scope: "person" | "household";
  onChange: (program: MonitoringProgram | null) => void; disabled?: boolean; allowCurrent?: boolean;
}) {
  const choices = programs.filter(p => p.status === "active" && supportsScope(p, scope));
  let selected = programs.find(p => p.id === id || (!id && p.name === name)) || null;
  if (!selected && allowCurrent && name) selected = {id: id || "legacy_current", name, category: "Previous program", scope, status: "archived", version: 0};
  if (selected && allowCurrent && name) selected = {...selected,name};
  if (selected && !choices.some(p => p.id === selected!.id)) choices.push(selected);
  choices.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return <Autocomplete disabled={disabled} options={choices} value={selected} groupBy={p => p.category}
    isOptionEqualToValue={(a,b) => a.id === b.id} getOptionLabel={p => p.name}
    getOptionDisabled={p => p.id === "legacy_current" || (!allowCurrent && p.status !== "active")}
    onChange={(_,program) => onChange(program)} noOptionsText="No matching program. Add it through Manage programs."
    renderOption={(props,p) => <li {...props} key={p.id}><Box><Typography>{p.name}</Typography>{p.status === "archived" && <Typography variant="caption">Archived · existing record only</Typography>}</Box></li>}
    renderInput={params => <TextField {...params} required label="Program" placeholder="Search programs" />} />;
}

export default function MonitoringProgramCatalog({programs,onClose}: {programs:MonitoringProgram[];onClose:()=>void}) {
  const [search,setSearch] = useState(""), [category,setCategory] = useState(""), [availability,setAvailability] = useState("active");
  const [editing,setEditing] = useState<MonitoringProgram|null>(null), [saving,setSaving] = useState(false), [error,setError] = useState(""), [notice,setNotice] = useState("");
  const inFlight = useRef(false), operation = useRef("");
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const shown = programs.filter(p => (!category || p.category === category) && (!availability || p.status === availability) && `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  function edit(program?: MonitoringProgram) {
    operation.current = monitoringKey(); setError("");
    setEditing(program ? {...program} : {id: `local_${monitoringKey()}`,name:"",category:"Local programs",scope:"person",status:"active",version:0});
  }
  async function save() {
    if (!editing || inFlight.current) return;
    inFlight.current = true;setSaving(true);setError("");
    try {await saveMonitoringProgram(editing,editing.version,operation.current);setEditing(null);setNotice("Program saved. Existing monitoring histories retain their recorded names.");}
    catch (e) {setError(e instanceof Error ? e.message : "Unable to save the program.");}
    finally {inFlight.current=false;setSaving(false);}
  }
  return <Dialog open fullWidth maxWidth="lg" fullScreen={mobile} onClose={()=>!saving&&onClose()} className="mr-dialog" aria-labelledby="mr-catalog-title">
    <DialogTitle id="mr-catalog-title"><div className="mr-title-row"><div>Program catalog<Typography component="span" display="block" variant="body2">Manage the programs available for monitoring.</Typography></div><IconButton aria-label="Close program catalog" disabled={saving} onClick={onClose}><CloseRounded /></IconButton></div></DialogTitle>
    <DialogContent dividers>{notice&&<Alert severity="success" sx={{mb:2}} onClose={()=>setNotice("")}>{notice}</Alert>}{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
      {editing ? <fieldset disabled={saving} className="mr-fieldset"><Typography component="h3">{editing.version || programs.some(p=>p.id===editing.id) ? "Edit program" : "Add local program"}</Typography><div className="mr-form-grid">
        <TextField autoFocus required label="Program name" value={editing.name} inputProps={{maxLength:160}} onChange={e=>setEditing({...editing,name:e.target.value})} className="mr-span-2" />
        <TextField select label="Category" value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{[...new Set([...PROGRAM_CATEGORIES,...programs.map(p=>p.category)])].map(c=><MenuItem value={c} key={c}>{c}</MenuItem>)}</TextField>
        <TextField select label="Monitoring scope" value={editing.scope} onChange={e=>setEditing({...editing,scope:e.target.value as MonitoringProgram["scope"]})}><MenuItem value="person">Individual member</MenuItem><MenuItem value="household">Household activity</MenuItem><MenuItem value="either">Individual or household</MenuItem></TextField>
        <TextField select label="Availability" value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as MonitoringProgram["status"]})}><MenuItem value="active">Available for new cases</MenuItem><MenuItem value="archived">Archived</MenuItem></TextField>
        <Typography variant="body2" className="mr-span-2">Archiving removes a program from new registrations. Saved cases and reports remain available.</Typography>
      </div></fieldset> : <>
        <div className="mr-catalog-filters"><TextField label="Search programs" value={search} onChange={e=>setSearch(e.target.value)} InputProps={{startAdornment:<InputAdornment position="start"><SearchRounded /></InputAdornment>}} /><TextField select label="Category" value={category} onChange={e=>setCategory(e.target.value)}><MenuItem value="">All categories</MenuItem>{[...new Set(programs.map(p=>p.category))].sort().map(c=><MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField><TextField select label="Availability" value={availability} onChange={e=>setAvailability(e.target.value)}><MenuItem value="active">Available</MenuItem><MenuItem value="archived">Archived</MenuItem><MenuItem value="">All programs</MenuItem></TextField></div>
        <div className="mr-section-heading"><Typography variant="body2">{shown.length} programs</Typography><Button variant="contained" startIcon={<AddRounded />} onClick={()=>edit()}>Add program</Button></div>
        <Typography variant="body2" sx={{mb:2}}>Starter templates cover common health, support and community activities. Keep the programs your barangay uses available and add local initiatives here.</Typography>
        <div className="mr-catalog-list">{shown.map(p=><article key={p.id}><div><strong>{p.name}</strong><Typography variant="body2">{p.category} · {p.scope === "either" ? "Individual or household" : p.scope === "person" ? "Individual member" : "Household activity"}</Typography></div><Chip label={p.status === "active" ? "Available" : "Archived"} size="small" variant="outlined" /><Button startIcon={<EditOutlined />} aria-label={`Edit ${p.name}`} onClick={()=>edit(p)}>Edit</Button></article>)}</div>{!shown.length&&<div className="mr-empty"><Typography>No programs match these filters.</Typography><Button onClick={()=>{setSearch("");setCategory("");setAvailability("");}}>Reset filters</Button></div>}
      </>}
    </DialogContent><DialogActions>{editing ? <><Button disabled={saving} onClick={()=>{setEditing(null);setError("");}}>Back to catalog</Button><Button variant="contained" disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save program"}</Button></> : <Button onClick={onClose}>Done</Button>}</DialogActions>
  </Dialog>;
}
