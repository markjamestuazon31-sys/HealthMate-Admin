import { useMemo, useRef, useState } from "react";
import { AddRounded, ArrowBackRounded, ArrowForwardRounded, CheckCircleOutlineRounded, CloseRounded, DeleteOutlineRounded, EditOutlined, HomeOutlined, PeopleAltOutlined, SearchRounded, TuneRounded } from "@mui/icons-material";
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Step, StepLabel, Stepper, TextField, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { Household } from "../../types";
import { BUNUANAN_PUROKS } from "../../config/bunuananServiceArea";
import { ageOn, todayInManila, type RegistryInhabitant } from "../../services/inhabitantModel";
import { blankCase, dateLabel, duplicateMonitoringCase, validateCase, type CaseInput, type MonitoringCase } from "../../services/monitoringModel";
import { programForName, supportsScope, type MonitoringProgram } from "../../services/monitoringPrograms";
import { createMonitoringEnrollment, type EnrollmentEntry } from "../../services/monitoringEnrollmentService";
import { monitoringKey } from "../../services/monitoringService";
import MonitoringProgramCatalog, { MonitoringProgramSelect } from "./MonitoringProgramCatalog";

const steps = ["Household", "Members", "Monitoring details", "Review"];
export default function MonitoringEnrollment({people,households,cases,programs,onClose,onSaved}: {
  people:RegistryInhabitant[];households:Household[];cases:MonitoringCase[];programs:MonitoringProgram[];
  onClose:()=>void;onSaved:(ids:string[])=>void;
}) {
  const [step,setStep]=useState(0), [householdId,setHouseholdId]=useState(""), [purok,setPurok]=useState("");
  const [selected,setSelected]=useState<string[]>([]), [scope,setScope]=useState<"person"|"household">("person"), [activeMember,setActiveMember]=useState("");
  const [entries,setEntries]=useState<EnrollmentEntry[]>([]), [memberSearch,setMemberSearch]=useState("");
  const [error,setError]=useState(""), [entryErrors,setEntryErrors]=useState<Record<string,string>>({}), [saving,setSaving]=useState(false);
  const [catalog,setCatalog]=useState(false), [shared,setShared]=useState(false), [sharedNotice,setSharedNotice]=useState("");
  const [common,setCommon]=useState({assignedTo:"",startDate:todayInManila(),firstFollowupDate:todayInManila()});
  const [discard,setDiscard]=useState(false), [nextHousehold,setNextHousehold]=useState<Household|null|undefined>(undefined);
  const inFlight=useRef(false), content=useRef<HTMLDivElement>(null);
  const mobile=useMediaQuery(useTheme().breakpoints.down("md"));
  const household=households.find(h=>h.id===householdId);
  const members=useMemo(()=>people.filter(p=>p.householdId===householdId&&p.status==="active").sort((a,b)=>a.fullName.localeCompare(b.fullName)),[people,householdId]);
  const currentMembers=members.filter(p=>selected.includes(p.id));
  const visibleMembers=members.filter(p=>p.fullName.toLowerCase().includes(memberSearch.toLowerCase().trim()));
  const activeEntries=entries.filter(e=>(e.input.scope||"person")===scope&&(scope==="household"||selected.includes(e.input.inhabitantId)));
  const activeId=scope==="household"?"household":currentMembers.some(p=>p.id===activeMember)?activeMember:currentMembers[0]?.id||"";
  const editingEntries=activeEntries.filter(e=>scope==="household"||e.input.inhabitantId===activeId);
  const subjectName=(entry:EnrollmentEntry)=>entry.input.scope==="household"?household?.householdName||"Household":people.find(p=>p.id===entry.input.inhabitantId)?.fullName||"Member";
  const staffOptions=[...new Set(cases.map(c=>c.assignedTo).filter(Boolean))].sort();
  function go(next:number){setStep(next);setError("");content.current?.scrollTo?.({top:0});}
  function makeEntry(personId:string,kind:"person"|"household"):EnrollmentEntry {
    return {id:monitoringKey(),input:{...blankCase(),scope:kind,householdId,inhabitantId:kind==="household"?"":personId,...common}};
  }
  function ensureEntries(){
    setEntries(old=>scope==="household" ? old.some(e=>e.input.scope==="household")?old:[...old,makeEntry("","household")] : [...old,...currentMembers.filter(p=>!old.some(e=>(e.input.scope||"person")==="person"&&e.input.inhabitantId===p.id)).map(p=>makeEntry(p.id,"person"))]);
  }
  function changeHousehold(value:Household|null){
    setHouseholdId(value?.id||"");setSelected([]);setEntries([]);setEntryErrors({});setActiveMember("");setMemberSearch("");setNextHousehold(undefined);setError("");
  }
  function selectHousehold(value:Household|null){if(value?.id===householdId)return;if(entries.length||selected.length)setNextHousehold(value);else changeHousehold(value);}
  function toggleMember(id:string){setSelected(old=>old.includes(id)?old.filter(p=>p!==id):[...old,id]);setError("");}
  function changeEntry(id:string,changes:Partial<CaseInput>){setEntries(old=>old.map(e=>e.id===id?{...e,input:{...e.input,...changes}}:e));setEntryErrors(old=>{const next={...old};delete next[id];return next;});setSharedNotice("");}
  function duplicate(entry:EnrollmentEntry){
    return cases.find(c=>c.status!=="Completed"&&duplicateMonitoringCase({...c,programId:c.programId||programForName(programs,c.program)?.id},{...entry.input,householdId}));
  }
  function errorsForEntries():Record<string,string>{
    const errors:Record<string,string>={};
    for(const entry of activeEntries){
      try{
        validateCase({...entry.input,householdId,participantIds:selected});
        const program=programs.find(p=>p.id===entry.input.programId);
        if(!program||program.status!=="active"||!supportsScope(program,scope))throw new Error("Select an available program for this monitoring scope.");
        if(duplicate(entry))throw new Error("An open case already exists. Remove this entry and use the existing case for followups.");
        if(activeEntries.some(other=>other.id!==entry.id&&duplicateMonitoringCase({...other.input,householdId},{...entry.input,householdId})))throw new Error("This program is selected twice for the same person or household.");
      }catch(e){errors[entry.id]=e instanceof Error?e.message:"Review this entry.";}
    }
    return errors;
  }
  function next(){
    if(!household||household.status!=="active"){setError("Select an active household.");return;}
    if(step===0){go(1);return;}
    if(!selected.length||currentMembers.length!==selected.length){setError("Select current members of this household. Remove any member who is no longer active.");return;}
    if(step===1){ensureEntries();go(2);return;}
    if(!activeEntries.length){setError("Add at least one program to monitor.");return;}
    if(activeEntries.length>100){setError("Save up to 100 cases at a time. Select fewer members or programs for this registration.");return;}
    if(scope==="person"&&currentMembers.some(p=>!activeEntries.some(e=>e.input.inhabitantId===p.id))){setError("Add a program for each selected member, or remove that member in the Members step.");return;}
    const errors=errorsForEntries();setEntryErrors(errors);
    if(Object.keys(errors).length){const first=activeEntries.find(e=>errors[e.id])!;setActiveMember(first.input.inhabitantId);setError("Review the highlighted monitoring details.");return;}
    go(3);
  }
  async function save(){
    if(inFlight.current)return;
    const errors=errorsForEntries();setEntryErrors(errors);
    if(Object.keys(errors).length){go(2);setError("Some details changed. Review the highlighted entries.");return;}
    inFlight.current=true;setSaving(true);setError("");
    try{const ids=await createMonitoringEnrollment(activeEntries.map(e=>({...e,input:{...e.input,householdId,participantIds:scope==="household"?selected:undefined}})),householdId);onSaved(ids);}
    catch(e){setError(e instanceof Error?e.message:"Unable to save. Your form is still available to retry.");}
    finally{inFlight.current=false;setSaving(false);}
  }
  function requestClose(){if(saving)return;if(entries.length||selected.length)setDiscard(true);else onClose();}
  const memberCaption=(p:RegistryInhabitant)=>[ageOn(p.birthDate)!==null?`${ageOn(p.birthDate)} years old`:"Age not recorded",p.relationshipToHead||"Relationship not recorded"].join(" · ");
  return <>
    <Dialog open fullWidth maxWidth="lg" fullScreen={mobile} onClose={requestClose} className="mr-dialog mr-enrollment" aria-labelledby="mr-enrollment-title">
      <DialogTitle id="mr-enrollment-title"><div className="mr-title-row"><div>Add monitoring<Typography component="span" display="block" variant="body2">Choose the household and organize each monitoring case.</Typography></div><IconButton aria-label="Close registration" disabled={saving} onClick={requestClose}><CloseRounded /></IconButton></div></DialogTitle>
      <div className="mr-stepper"><Stepper activeStep={step} alternativeLabel>{steps.map(label=><Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></div>
      <DialogContent dividers ref={content} tabIndex={-1}>
        {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
        <fieldset disabled={saving} className="mr-fieldset">
          {step===0&&<div className="mr-household-stage"><span className="mr-stage-icon"><HomeOutlined /></span><Typography component="h3">Which household are you visiting?</Typography><Typography variant="body2" sx={{mb:3}}>Search the masterlist by household name, head or address.</Typography>
            <div className="mr-household-search"><TextField select label="Purok" value={purok} onChange={e=>setPurok(e.target.value)}><MenuItem value="">All Puroks</MenuItem>{BUNUANAN_PUROKS.map(p=><MenuItem value={p} key={p}>{p}</MenuItem>)}</TextField>
              <Autocomplete options={households.filter(h=>h.status==="active"&&(!purok||h.purokId===purok))} value={household||null} onChange={(_,h)=>selectHousehold(h)} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={h=>h.householdName||h.id}
                filterOptions={(options,state)=>{const words=state.inputValue.toLowerCase().trim().split(/\s+/);return options.filter(h=>{const text=[h.householdName,h.householdHeadName,h.address,h.purokId,h.id,...people.filter(p=>p.householdId===h.id&&p.isHouseholdHead).map(p=>p.fullName)].join(" ").toLowerCase();return words.every(w=>text.includes(w));});}}
                renderOption={(props,h)=><li {...props} key={h.id}><Box><Typography>{h.householdName}</Typography><Typography variant="caption">{h.purokId} · {h.address} · {h.id.slice(-6)}</Typography></Box></li>}
                renderInput={params=><TextField {...params} autoFocus required label="Select household" placeholder="Search households" />} noOptionsText="No active household found. Register the household in Inhabitants profiling first." />
            </div>{household&&<div className="mr-household-preview"><HomeOutlined /><div><strong>{household.householdName}</strong><Typography variant="body2">{household.purokId} · {household.address}</Typography><Typography variant="body2">{members.length} active members</Typography></div></div>}
          </div>}
          {step===1&&<><div className="mr-stage-heading"><div><Typography component="h3">Who needs monitoring?</Typography><Typography variant="body2">{household?.householdName} · {household?.purokId}</Typography></div><Chip icon={<PeopleAltOutlined />} label={`${selected.length} selected`} /></div>
            <ToggleButtonGroup exclusive fullWidth value={scope} onChange={(_,value)=>{if(value){setScope(value);setError("");}}} className="mr-scope-toggle" aria-label="Monitoring scope"><ToggleButton value="person">Individual programs</ToggleButton><ToggleButton value="household">Household activity</ToggleButton></ToggleButtonGroup>
            <Typography variant="body2" sx={{my:2}}>{scope==="person"?"Each selected member gets separate programs, conditions and followups.":"One household case records a shared activity or benefit. Select the covered members; individual health results belong in individual cases."}</Typography>
            <TextField fullWidth label="Search household members" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} InputProps={{startAdornment:<InputAdornment position="start"><SearchRounded /></InputAdornment>}} />
            <div className="mr-selection-tools"><FormControlLabel control={<Checkbox checked={members.length>0&&members.every(p=>selected.includes(p.id))} indeterminate={selected.length>0&&selected.length<members.length} onChange={(_,checked)=>setSelected(checked?members.map(p=>p.id):[])} />} label="Select all household members" /><Button onClick={()=>setSelected([])} disabled={!selected.length}>Clear selection</Button></div>
            <div className="mr-member-grid">{visibleMembers.map(p=><label className={`mr-member-choice ${selected.includes(p.id)?"is-selected":""}`} key={p.id}><Checkbox checked={selected.includes(p.id)} onChange={()=>toggleMember(p.id)} inputProps={{"aria-label":`Select ${p.fullName}`}} /><div><strong>{p.fullName}</strong><Typography variant="body2">{memberCaption(p)}</Typography></div></label>)}</div>
            {!visibleMembers.length&&<Alert severity="info">{members.length?"No members match your search.":"This household has no active members. Add its members in Inhabitants profiling first."}</Alert>}
          </>}
          {step===2&&<><div className="mr-stage-heading"><div><Typography component="h3">Set monitoring details</Typography><Typography variant="body2">{household?.householdName} · {activeEntries.length} cases</Typography></div><Button startIcon={<TuneRounded />} onClick={()=>setCatalog(true)}>Manage programs</Button></div>
            <div className="mr-shared-settings"><Button onClick={()=>setShared(v=>!v)} aria-expanded={shared} aria-controls="mr-shared-fields">Shared staff and dates</Button><Collapse in={shared}><div id="mr-shared-fields" className="mr-shared-fields"><Autocomplete freeSolo options={staffOptions} inputValue={common.assignedTo} onInputChange={(_,v)=>setCommon({...common,assignedTo:v})} renderInput={params=><TextField {...params} label="Shared assigned staff" />} /><TextField type="date" label="Shared start date" value={common.startDate} InputLabelProps={{shrink:true}} onChange={e=>setCommon({...common,startDate:e.target.value})} /><TextField type="date" label="Shared first followup" value={common.firstFollowupDate} InputLabelProps={{shrink:true}} onChange={e=>setCommon({...common,firstFollowupDate:e.target.value})} /><Button variant="outlined" onClick={()=>{const ids=new Set(activeEntries.map(e=>e.id));setEntries(old=>old.map(e=>ids.has(e.id)?{...e,input:{...e.input,...common}}:e));setEntryErrors({});setSharedNotice(`Staff and dates applied to ${activeEntries.length} cases. Review each member before saving.`);}}>Apply to all {activeEntries.length} cases</Button></div></Collapse>{sharedNotice&&<Typography role="status" variant="body2" sx={{p:1}}>{sharedNotice}</Typography>}</div>
            <div className="mr-enrollment-workspace"><nav className="mr-member-nav" aria-label="Selected members">{(scope==="household"?[{id:"household",fullName:household?.householdName||"Household"}]:currentMembers).map(p=>{const count=activeEntries.filter(e=>scope==="household"||e.input.inhabitantId===p.id).length;const hasError=activeEntries.some(e=>entryErrors[e.id]&&(scope==="household"||e.input.inhabitantId===p.id));return <button type="button" key={p.id} className={activeId===p.id?"is-active":""} aria-current={activeId===p.id?"step":undefined} onClick={()=>setActiveMember(p.id)}><span>{p.fullName}</span><small>{count} {count===1?"program":"programs"}{hasError?" · Needs attention":""}</small></button>;})}</nav>
              <div className="mr-member-editor"><div className="mr-stage-heading"><div><Typography component="h3">{scope==="household"?household?.householdName:currentMembers.find(p=>p.id===activeId)?.fullName}</Typography><Typography variant="body2">{scope==="household"?`${selected.length} covered members`:"Add a separate entry for each program."}</Typography></div></div>
                {editingEntries.map((entry,index)=><section key={entry.id} className={`mr-enrollment-case ${entryErrors[entry.id]?"has-error":""}`}><div className="mr-case-entry-heading"><strong>Program {index+1}</strong><Button color="inherit" startIcon={<DeleteOutlineRounded />} aria-label={`Remove program ${index+1} for ${subjectName(entry)}`} onClick={()=>setEntries(old=>old.filter(e=>e.id!==entry.id))}>Remove</Button></div>
                  <div className="mr-form-grid"><MonitoringProgramSelect programs={programs} id={entry.input.programId} name={entry.input.program} scope={scope} onChange={p=>changeEntry(entry.id,{programId:p?.id||"",program:p?.name||""})} disabled={saving} /><TextField label={scope==="household"?"Activity or support focus":"Health condition or focus"} value={entry.input.condition} inputProps={{maxLength:160}} onChange={e=>changeEntry(entry.id,{condition:e.target.value})} placeholder={scope==="household"?"Purpose of this household activity":"Recorded condition or reason for monitoring"} />
                    <Autocomplete freeSolo options={staffOptions} inputValue={entry.input.assignedTo} onInputChange={(_,value)=>changeEntry(entry.id,{assignedTo:value})} renderInput={params=><TextField {...params} required label="Assigned staff" />} />
                    <TextField type="date" required label="Case start date" value={entry.input.startDate} InputLabelProps={{shrink:true}} onChange={e=>changeEntry(entry.id,{startDate:e.target.value})} /><TextField type="date" required label="First followup date" value={entry.input.firstFollowupDate} inputProps={{min:entry.input.startDate}} InputLabelProps={{shrink:true}} onChange={e=>changeEntry(entry.id,{firstFollowupDate:e.target.value})} />
                    <TextField label="Case notes" multiline minRows={2} className="mr-span-2" value={entry.input.notes} inputProps={{maxLength:4000}} onChange={e=>changeEntry(entry.id,{notes:e.target.value})} />
                  </div>{(entryErrors[entry.id]||duplicate(entry))&&<Alert severity="warning" sx={{mt:2}}>{entryErrors[entry.id]||"An open case already exists for this program. Remove this entry and continue followups in that case."}</Alert>}
                </section>)}
                <Button startIcon={<AddRounded />} variant="outlined" disabled={activeEntries.length>=100} onClick={()=>setEntries(old=>[...old,makeEntry(activeId,scope)])}>Add another program</Button>
              </div></div>
          </>}
          {step===3&&<><div className="mr-stage-heading"><div><Typography component="h3">Review before saving</Typography><Typography variant="body2">Check each program, person and followup date.</Typography></div><CheckCircleOutlineRounded color="success" /></div><div className="mr-review-summary"><div><span>Household</span><strong>{household?.householdName}</strong></div><div><span>{scope==="household"?"Covered members":"Selected members"}</span><strong>{currentMembers.length}</strong></div><div><span>Monitoring cases</span><strong>{activeEntries.length}</strong></div><div><span>First followups</span><strong>{activeEntries.length}</strong></div></div>
            {scope==="household"&&<Typography sx={{mb:2}}>Covered members: {currentMembers.map(p=>p.fullName).join(", ")}</Typography>}
            <div className="mr-review-list">{activeEntries.map(entry=><article key={entry.id}><div><strong>{subjectName(entry)}</strong><Typography>{entry.input.program}</Typography><Typography variant="body2">{entry.input.condition||"General monitoring"}</Typography></div><div><Typography variant="body2">Assigned staff</Typography><Typography>{entry.input.assignedTo}</Typography></div><div><Typography variant="body2">First followup</Typography><Typography>{dateLabel(entry.input.firstFollowupDate)}</Typography><Typography variant="body2">Starts {dateLabel(entry.input.startDate)}</Typography></div><Button startIcon={<EditOutlined />} aria-label={`Edit ${entry.input.program} for ${subjectName(entry)}`} onClick={()=>{setActiveMember(entry.input.inhabitantId);go(2);}}>Edit</Button></article>)}</div>
            <Typography variant="body2" sx={{mt:2}}>Each case starts as Active with one Pending followup. Record results after the activity takes place.</Typography>
          </>}
        </fieldset>
      </DialogContent><DialogActions className="mr-enrollment-footer"><Typography variant="body2">Step {step+1} of 4{household?` · ${household.householdName}`:""}</Typography><div><Button disabled={saving} onClick={step?()=>go(step-1):requestClose} startIcon={step?<ArrowBackRounded />:undefined}>{step?"Back":"Cancel"}</Button>{step<3?<Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={next}>{step===2?"Review cases":"Next"}</Button>:<Button variant="contained" disabled={saving} onClick={()=>void save()}>{saving?"Saving registration…":`Save ${activeEntries.length} ${activeEntries.length===1?"case":"cases"}`}</Button>}</div></DialogActions>
    </Dialog>
    {catalog&&<MonitoringProgramCatalog programs={programs} onClose={()=>setCatalog(false)} />}
    <Dialog open={discard||nextHousehold!==undefined} onClose={()=>{setDiscard(false);setNextHousehold(undefined);}} aria-labelledby="mr-discard-title"><DialogTitle id="mr-discard-title">{discard?"Close this registration?":"Change the household?"}</DialogTitle><DialogContent>Your unsaved member selections and monitoring details will be cleared.</DialogContent><DialogActions><Button onClick={()=>{setDiscard(false);setNextHousehold(undefined);}}>Keep editing</Button><Button color="error" onClick={()=>{if(discard)onClose();else changeHousehold(nextHousehold||null);setDiscard(false);}}>Discard unsaved details</Button></DialogActions></Dialog>
  </>;
}
