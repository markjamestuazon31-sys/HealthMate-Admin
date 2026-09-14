import { useRef, useState, type ReactNode } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { MonitoringProgramSelect } from "./MonitoringProgramCatalog";
import type { MonitoringProgram } from "../../services/monitoringPrograms";
import type { Household } from "../../types";
import { ageOn, personLocation, todayInManila, type RegistryInhabitant } from "../../services/inhabitantModel";
import { ACTIVITY_STATUSES, ATTENDANCE_OPTIONS, CASE_STATUSES, blankActivity, blankCase, details, isRecorded, pending, type ActivityInput, type ActivityStatus, type CaseInput, type MonitoringActivity, type MonitoringCase } from "../../services/monitoringModel";
import { createMonitoringCase, monitoringKey, saveMonitoringActivity, updateMonitoringCase } from "../../services/monitoringService";

function Section({title,children}:{title:string;children:ReactNode}) { return <section className="mr-form-section"><Typography component="h3">{title}</Typography><div className="mr-form-grid">{children}</div></section>; }
function FormShell({title,subtitle,children,saving,error,onClose,onSave,label}:{title:string;subtitle:string;children:ReactNode;saving:boolean;error:string;onClose:()=>void;onSave:()=>void;label:string}) {
  const fullScreen=useMediaQuery(useTheme().breakpoints.down("sm"));
  return <Dialog open onClose={()=>!saving&&onClose()} fullWidth maxWidth="md" fullScreen={fullScreen} className="mr-dialog" aria-labelledby="mr-form-title"><DialogTitle id="mr-form-title">{title}<Typography component="span" display="block" variant="body2">{subtitle}</Typography></DialogTitle><DialogContent dividers>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}<fieldset disabled={saving} className="mr-fieldset">{children}</fieldset></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" onClick={onSave} disabled={saving}>{saving?"Saving…":label}</Button></DialogActions></Dialog>;
}
export function CaseForm({record,people,households,cases,programs,onClose,onSaved}:{record?:MonitoringCase;programs:MonitoringProgram[];people:RegistryInhabitant[];households:Household[];cases:MonitoringCase[];onClose:()=>void;onSaved:(id:string)=>void}) {
  const [baseline]=useState(record),[value,setValue]=useState<CaseInput>(()=>record?{...blankCase(),...details(record),inhabitantId:record.inhabitantId,scope:record.scope||"person",householdId:record.householdId||record.person.householdId||"",participantIds:Object.keys(record.participants||{})}:blankCase());
  const [saving,setSaving]=useState(false),[error,setError]=useState("");const inFlight=useRef(false),operation=useRef<string | undefined>(undefined);
  const byId=new Map(households.map(h=>[h.id,h]));
  const choices=people.filter(p=>p.status==="active"&&(!byId.get(p.householdId)||byId.get(p.householdId)?.status==="active"));
  const person=people.find(p=>p.id===value.inhabitantId),location=person?personLocation(person,byId.get(person.householdId)):null;
  const change=<K extends keyof CaseInput>(name:K,next:CaseInput[K])=>setValue(v=>({...v,[name]:next}));
  const duplicate=!baseline&&cases.some(c=>c.inhabitantId===value.inhabitantId&&c.status!=="Completed"&&c.program.toLowerCase()===value.program.trim().toLowerCase());
  async function save(){if(inFlight.current)return;inFlight.current=true;setSaving(true);setError("");try{operation.current ||= monitoringKey();const id=baseline?baseline.id:operation.current;if(baseline)await updateMonitoringCase(id,baseline.version,value,operation.current);else await createMonitoringCase(value,id);onSaved(id);}catch(e){setError(e instanceof Error?e.message:"Unable to save this case.");}finally{inFlight.current=false;setSaving(false);}}
  return <FormShell title={baseline?"Edit monitoring case":"Add monitoring"} subtitle={baseline?baseline.person.fullName:"Choose an inhabitant and set the first followup."} saving={saving} error={error} onClose={onClose} onSave={()=>void save()} label={baseline?"Save changes":"Create monitoring case"}>
    <Section title={baseline?.scope==="household"?"Household activity":"Inhabitant"}>
      {!baseline&&<Autocomplete className="mr-span-2" options={choices} value={person||null} onChange={(_,p)=>change("inhabitantId",p?.id||"")} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={p=>p.fullName} renderOption={(props,p)=><li {...props} key={p.id}><Box><Typography>{p.fullName}</Typography><Typography variant="caption">{personLocation(p,byId.get(p.householdId)).purokId||"Purok not recorded"} · {byId.get(p.householdId)?.householdName||"No household"} · {p.id.slice(-8)}</Typography></Box></li>} renderInput={params=><TextField {...params} required label="Select inhabitant" placeholder="Search the masterlist" />} />}
      {(person||baseline)&&<Box className="mr-person-preview mr-span-2"><strong>{person?.fullName||baseline?.person.fullName}</strong><span>{location?.purokId||baseline?.person.purok||"Purok not recorded"} · {person?byId.get(person.householdId)?.householdName||"Household not assigned":baseline?.person.householdName||"Household not assigned"}</span><span>{baseline?.scope==="household"?"Household activity":person?ageOn(person.birthDate)===null?"Age not recorded":`${ageOn(person.birthDate)} years old`:baseline?.person.sex} · {location?.address||baseline?.person.address||"Address not recorded"}</span></Box>}
      {baseline?.scope==="household"&&<Typography className="mr-span-2">Covered members: {Object.values(baseline.participants||{}).map(p=>p.fullName).join(", ")}</Typography>}
      {!baseline&&!choices.length&&<Alert severity="info" className="mr-span-2">Register an active inhabitant in the masterlist first.</Alert>}
    </Section>
    <Section title="Program and responsibility">
      <MonitoringProgramSelect programs={programs} id={value.programId} name={value.program} scope={value.scope||"person"} allowCurrent={Boolean(baseline)} onChange={p=>setValue(v=>({...v,program:p?.name||"",programId:p?.id||""}))} />
      <TextField label={value.scope==="household"?"Activity or support focus":"Health condition or focus"} value={value.condition} onChange={e=>change("condition",e.target.value)} placeholder="Condition, activity or support being monitored" />
      <TextField label="Assigned staff" required value={value.assignedTo} onChange={e=>change("assignedTo",e.target.value)} helperText="Name of the person responsible for followup." />
      <TextField label="Case start date" type="date" required InputLabelProps={{shrink:true}} value={value.startDate} onChange={e=>change("startDate",e.target.value)} />
      {!baseline&&<TextField label="First followup date" type="date" required InputLabelProps={{shrink:true}} inputProps={{min:value.startDate}} value={value.firstFollowupDate} onChange={e=>change("firstFollowupDate",e.target.value)} />}
      <TextField label="Case notes" value={value.notes} onChange={e=>change("notes",e.target.value)} multiline minRows={3} className="mr-span-2" />
      {duplicate&&<Alert severity="warning" className="mr-span-2">An open case already exists for this inhabitant and program. Use that case for the next visit.</Alert>}
    </Section>
    {baseline&&<Section title="Case status and correction">
      <TextField select label="Case status" value={value.status} onChange={e=>change("status",e.target.value as CaseInput["status"])}>{CASE_STATUSES.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
      {value.status==="Completed"&&<><TextField label="Completion date" type="date" required InputLabelProps={{shrink:true}} inputProps={{min:value.startDate,max:todayInManila()}} value={value.completedDate} onChange={e=>change("completedDate",e.target.value)} /><TextField label="Completion result" required multiline minRows={2} className="mr-span-2" value={value.closureNotes} onChange={e=>change("closureNotes",e.target.value)} />{pending(baseline).length>0&&<FormControlLabel className="mr-span-2" control={<Checkbox checked={value.cancelPending} onChange={e=>change("cancelPending",e.target.checked)} />} label={`Cancel the ${pending(baseline).length} remaining pending followup(s) when completing this case`} />}</>}
      {baseline.status==="Completed"&&value.status!=="Completed"&&<Alert severity="info" className="mr-span-2">The case will reopen. Schedule a new followup after saving; cancelled appointments stay in the history.</Alert>}
      <TextField label="Reason for change" required multiline minRows={2} className="mr-span-2" value={value.reason} onChange={e=>change("reason",e.target.value)} helperText="Saved in the change history with your account and timestamp." />
    </Section>}
  </FormShell>;
}
export function ActivityForm({record,activity,mode,onClose,onSaved}:{record:MonitoringCase;activity?:MonitoringActivity;mode:ActivityStatus;onClose:()=>void;onSaved:()=>void}) {
  const [baseline]=useState(record),[original]=useState(activity);
  const [value,setValue]=useState<ActivityInput>(()=>activity?{...blankActivity(mode),...activity,status:mode,actualDate:isRecorded(activity)?activity.actualDate:mode==="Pending"?"":todayInManila(),attendance:isRecorded(activity)?activity.attendance:"Present",nextFollowupDate:"",reason:activity.status==="Pending"&&mode==="Done"?"Recorded scheduled visit":""}: {...blankActivity(mode),scheduledDate:record.startDate>todayInManila()?record.startDate:todayInManila()});
  const [saving,setSaving]=useState(false),[error,setError]=useState("");const inFlight=useRef(false),operation=useRef<string | undefined>(undefined);
  const change=<K extends keyof ActivityInput>(name:K,next:ActivityInput[K])=>setValue(v=>({...v,[name]:next}));
  const recorded=value.status==="Done"||value.status==="Referred";
  async function save(){if(inFlight.current)return;inFlight.current=true;setSaving(true);setError("");try{operation.current ||= monitoringKey();await saveMonitoringActivity(baseline.id,baseline.version,value,operation.current);onSaved();}catch(e){setError(e instanceof Error?e.message:"Unable to save this activity.");}finally{inFlight.current=false;setSaving(false);}}
  return <FormShell title={original?"Update activity":mode==="Pending"?"Schedule followup":"Record activity"} subtitle={`${baseline.person.fullName} · ${baseline.program}`} saving={saving} error={error} onClose={onClose} onSave={()=>void save()} label={original?"Save activity changes":recorded?"Save activity":"Save followup"}>
    <Section title="Activity details">
      <TextField label="Activity name" required value={value.activityType} onChange={e=>change("activityType",e.target.value)} />
      <TextField select label="Activity status" value={value.status} onChange={e=>setValue(v=>({...v,status:e.target.value as ActivityStatus,...(["Pending","Cancelled"].includes(e.target.value)?{actualDate:"",nextFollowupDate:""}:{actualDate:v.actualDate||todayInManila()})}))}>{ACTIVITY_STATUSES.map(s=><MenuItem value={s} key={s}>{s}</MenuItem>)}</TextField>
      <TextField label="Scheduled date" type="date" required InputLabelProps={{shrink:true}} inputProps={{min:baseline.startDate}} value={value.scheduledDate} onChange={e=>change("scheduledDate",e.target.value)} />
      {recorded&&<><TextField label="Actual activity date" type="date" required InputLabelProps={{shrink:true}} inputProps={{min:baseline.startDate,max:todayInManila()}} value={value.actualDate} onChange={e=>change("actualDate",e.target.value)} /><TextField select label="Attendance" required value={value.attendance} onChange={e=>change("attendance",e.target.value)}>{ATTENDANCE_OPTIONS.map(s=><MenuItem value={s} key={s}>{s}</MenuItem>)}</TextField></>}
    </Section>
    {recorded&&<Section title="Result and next action"><TextField label="Observations" multiline minRows={3} value={value.observations} onChange={e=>change("observations",e.target.value)} /><TextField label="Result" required multiline minRows={3} value={value.result} onChange={e=>change("result",e.target.value)} /><TextField label="Action taken" required multiline minRows={3} className="mr-span-2" value={value.actionTaken} onChange={e=>change("actionTaken",e.target.value)} />
      {value.status==="Referred"&&<><TextField label="Referred to" required value={value.referredTo} onChange={e=>change("referredTo",e.target.value)} /><TextField label="Referral reason" required multiline minRows={2} value={value.referralReason} onChange={e=>change("referralReason",e.target.value)} /></>}
      {(!original||!isRecorded(original))&&<TextField label="Next followup date (optional)" type="date" InputLabelProps={{shrink:true}} inputProps={{min:value.actualDate}} value={value.nextFollowupDate} onChange={e=>change("nextFollowupDate",e.target.value)} helperText="Creates a separate pending followup when this activity is saved." />}
    </Section>}
    {(original||value.status==="Cancelled")&&<Section title="Change history"><TextField label="Reason for activity change" required className="mr-span-2" multiline minRows={2} value={value.reason} onChange={e=>change("reason",e.target.value)} /></Section>}
    <Typography variant="body2" className="mr-form-note">{record.scope==="household"?"Household attendance records the shared activity, not each member’s individual health outcome. ":""}Done records this activity. Complete the case separately when the overall monitoring has ended.</Typography>
  </FormShell>;
}
