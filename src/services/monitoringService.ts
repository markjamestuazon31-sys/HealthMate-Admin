import { get, onValue, push, ref, runTransaction } from "firebase/database";
import { auth, database } from "../firebase/config";
import { type RegistryInhabitant } from "./inhabitantModel";
import { blankActivity, cleanDetails, context, details, makeActivity, pending, validateActivity, validateCase, type ActivityInput, type CaseInput, type ChangeEntry, type MonitoringCase, duplicateMonitoringCase } from "./monitoringModel";
import { createMonitoringEnrollment } from "./monitoringEnrollmentService";
import { getMonitoringPrograms } from "./monitoringProgramService";
import { programForName, supportsScope } from "./monitoringPrograms";
const PATH = "monitoringCases";
function key(value: string) { if (!value || /[.#$\[\]/\u0000-\u001f\u007f]/.test(value)) throw new Error("Invalid monitoring record identifier."); return value; }
export function monitoringKey(): string { const id=push(ref(database,PATH)).key; if(!id)throw new Error("Unable to prepare the monitoring record.");return id; }
function actor() { const user=auth.currentUser;if(!user)throw new Error("Your session has expired. Sign in again.");return {uid:user.uid,name:user.displayName?.trim()||user.email||user.uid}; }
function normalize(id: string, value: MonitoringCase): MonitoringCase {
  const record={...value,id,activities:value.activities||{},history:value.history||{}};
  record.activities=Object.fromEntries(Object.entries(record.activities).map(([activityId,a])=>[activityId,{...a,id:activityId,context:a.context||context(record)}]));
  return record;
}
export function listenMonitoringCases(callback:(cases:MonitoringCase[])=>void,onError:(error:Error)=>void) {
  return onValue(ref(database,PATH),snapshot=>{
    try { const raw=(snapshot.val()||{}) as Record<string,MonitoringCase>;callback(Object.entries(raw).map(([id,value])=>normalize(id,value)).sort((a,b)=>b.updatedAt-a.updatedAt)); }
    catch { onError(new Error("Some monitoring records have an invalid format. Review the monitoringCases data.")); }
  },onError);
}
function historyEntry(id:string,action:string,reason:string,before:ChangeEntry["before"],after:ChangeEntry["after"],affected:string[],uid:string,name:string,now:number):ChangeEntry {
  return {id,action,reason:reason.trim(),before,after,affectedActivityIds:affected,by:uid,actorName:name,at:now};
}
export async function createMonitoringCase(input:CaseInput,id:string):Promise<string> {
  key(id);validateCase(input);
  const person=input.inhabitantId ? (await get(ref(database,`inhabitants/${key(input.inhabitantId)}`))).val() as RegistryInhabitant|null : null;
  const householdId=input.householdId||person?.householdId||"";
  if(!householdId)throw new Error("Assign this inhabitant to a household in the masterlist first.");
  return (await createMonitoringEnrollment([{id,input}],householdId))[0];
}
async function changeCase(id:string,version:number,operationId:string,change:(current:MonitoringCase,uid:string,name:string,now:number)=>MonitoringCase,check?:(next:MonitoringCase,all:MonitoringCase[])=>void):Promise<void> {
  key(id);key(operationId);const {uid,name}=actor(),now=Date.now();
  const before=await get(ref(database,`${PATH}/${id}`));if(!before.exists())throw new Error("This monitoring case no longer exists.");
  if((before.val() as MonitoringCase).history?.[operationId]?.by===uid)return;
  let conflict="";
  const result=await runTransaction(ref(database,PATH),raw=>{
    if(raw===null)return null;
    if(!raw[id]){conflict="This case no longer exists.";return;}
    const current=normalize(id,raw[id]);
    if(current.history[operationId]?.by===uid)return raw;
    if(current.version!==version){conflict="This case changed while you were editing. Close the form and reopen it to load the latest version.";return;}
    const next=change(current,uid,name,now);
    check?.(next,Object.values(raw));
    return {...raw,[id]:{...next,version:current.version+1,updatedAt:now,updatedBy:uid}};
  },{applyLocally:false});
  if(!result.committed||!result.snapshot.child(id).exists())throw new Error(conflict||"The case was not saved. Reload the record and try again.");
}
export async function updateMonitoringCase(id:string,version:number,input:CaseInput,operationId:string):Promise<void> {
  const programs=await getMonitoringPrograms();
  await changeCase(id,version,operationId,(old,uid,name,now)=>{
    validateCase(input,old);
    if(input.program!==old.program||input.programId!==old.programId){
      const program=input.programId?programs.find(p=>p.id===input.programId):programForName(programs,input.program);
      if(!program||program.status!=="active"||!supportsScope(program,old.scope||"person"))throw new Error("Choose an available program for this case scope.");
      input={...input,programId:program.id,program:program.name};
    }
    const next={...old,...cleanDetails(input),activities:{...old.activities},history:{...old.history}},cancelled:string[]=[];
    for(const a of pending(old))next.activities[a.id]={...a,context:context(next)};
    if(next.status==="Completed")for(const a of pending(old)){
      cancelled.push(a.id);next.activities[a.id]={...a,status:"Cancelled",updatedAt:now,updatedBy:uid};
    }
    const action=next.status==="Completed"&&old.status!=="Completed"?"Case completed":old.status==="Completed"&&next.status!=="Completed"?"Case reopened":"Case updated";
    next.history[operationId]=historyEntry(operationId,action,input.reason,details(old),details(next),cancelled,uid,name,now);
    return next;
  },(next,all)=>{
    if(next.status==="Completed")return;
    const canonical=(c:MonitoringCase)=>({...c,programId:c.programId||programForName(programs,c.program)?.id});
    if(all.some(c=>c.id!==next.id&&c.status!=="Completed"&&duplicateMonitoringCase(canonical(c),canonical(next))))throw new Error("An open case already exists for this member or household and program.");
  });
}
export async function saveMonitoringActivity(id:string,version:number,input:ActivityInput,operationId:string):Promise<void> {
  if(input.id)key(input.id);
  await changeCase(id,version,operationId,(old,uid,name,now)=>{
    validateActivity(input,old);const activityId=input.id||`visit_${operationId}`;
    const activity=makeActivity(input,old,activityId,uid,now);
    const next={...old,activities:{...old.activities,[activityId]:activity},history:{...old.history}};
    const affected=[activityId];
    if(input.nextFollowupDate){const nextId=`next_${operationId}`;affected.push(nextId);next.activities[nextId]=makeActivity({...blankActivity(),scheduledDate:input.nextFollowupDate},next,nextId,uid,now);}
    next.history[operationId]=historyEntry(operationId,input.id?"Activity updated":input.status==="Pending"?"Followup scheduled":"Activity recorded",input.reason,old.activities[activityId]||null,activity,affected,uid,name,now);
    return next;
  });
}
