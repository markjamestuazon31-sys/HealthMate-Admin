import { useEffect, useMemo, useRef, useState } from "react";
import { AssessmentOutlined, ArticleOutlined, CampaignOutlined, CheckCircleOutlineRounded, CloudOffOutlined, ContactPhoneOutlined, DownloadRounded, ExpandMoreRounded, GroupsOutlined, HistoryOutlined, HomeWorkOutlined, LocalHospitalOutlined, MapOutlined, NotificationsNoneRounded, PrintRounded, RefreshRounded, SearchRounded, SupportAgentOutlined, TaskAltRounded } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Button, Chip, CircularProgress, InputAdornment, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField } from "@mui/material";
import { emptyReportSnapshot, listenSystemReportData, REPORT_SOURCE_LABELS } from "../services/reportService";
import { BUNUANAN_PUROKS } from "../config/bunuananServiceArea";
import { SECTORS } from "../services/inhabitantModel";
import { buildGeneratedReport, describeReportFilter, titleCase, DEFAULT_REPORT_FILTERS, downloadReportCsv, presetDates, printGeneratedReport, REPORT_CATALOG, selectReportSection, type GeneratedReport, type ReportFilters, type ReportSection, type ReportType } from "../utils/reportGenerator";
import "../styles/reports.css";

function ReportIcon({type}:{type:ReportType}) {
  switch(type){case"emergencies":return <LocalHospitalOutlined/>;case"rescue":return <ArticleOutlined/>;case"heatmap":return <MapOutlined/>;case"population":return <HomeWorkOutlined/>;case"population-summary":case"residents":return <GroupsOutlined/>;case"monitoring":case"programs":return <TaskAltRounded/>;case"responders":return <SupportAgentOutlined/>;case"directory":return <ContactPhoneOutlined/>;case"announcements":return <CampaignOutlined/>;case"notifications":return <NotificationsNoneRounded/>;case"audit":return <HistoryOutlined/>;default:return <AssessmentOutlined/>;}
}
const groups=[...new Set(REPORT_CATALOG.map(d=>d.group))];
function SectionTable({section}:{section:ReportSection}) {
  const [page,setPage]=useState(0),[size,setSize]=useState(10);
  useEffect(()=>setPage(0),[section]);
  return <><p className="rc-section-description">{section.description}</p><TableContainer className="rc-table-container" tabIndex={0} role="region" aria-label={`${section.title} table, scroll horizontally for more columns`}><Table stickyHeader aria-label={section.title}><TableHead><TableRow>{section.columns.map(c=><TableCell key={c.key} scope="col">{c.label}</TableCell>)}</TableRow></TableHead><TableBody>{section.rows.length?section.rows.slice(page*size,(page+1)*size).map((row,i)=><TableRow key={i} hover>{section.columns.map(c=><TableCell key={c.key}>{String(row[c.key]??"")}</TableCell>)}</TableRow>):<TableRow><TableCell colSpan={section.columns.length}><div className="rc-table-empty">No records match these filters.</div></TableCell></TableRow>}</TableBody></Table></TableContainer><TablePagination component="div" count={section.rows.length} page={page} onPageChange={(_,p)=>setPage(p)} rowsPerPage={size} onRowsPerPageChange={e=>{setSize(Number(e.target.value));setPage(0);}} rowsPerPageOptions={[10,25,50]} labelRowsPerPage="Rows"/></>;
}
export default function Reports() {
  const [type,setType]=useState<ReportType>("complete"),[filters,setFilters]=useState<ReportFilters>({...DEFAULT_REPORT_FILTERS});
  const [snapshot,setSnapshot]=useState(emptyReportSnapshot),[retry,setRetry]=useState(0),[slow,setSlow]=useState(false);
  const [generated,setGenerated]=useState<GeneratedReport|null>(null),[inputAtGeneration,setInputAtGeneration]=useState(""),[revisionAtGeneration,setRevisionAtGeneration]=useState(0);
  const [sectionId,setSectionId]=useState(""),[view,setView]=useState<"overview"|"tables">("overview"),[message,setMessage]=useState("");
  const preview=useRef<HTMLElement>(null);
  useEffect(()=>{
    setSnapshot(emptyReportSnapshot());setSlow(false);setGenerated(null);
    const stop=listenSystemReportData(setSnapshot),timer=setTimeout(()=>setSlow(true),15000);
    return()=>{stop();clearTimeout(timer);};
  },[retry]);
  const definition=REPORT_CATALOG.find(d=>d.id===type)!;
  const problems=definition.sources.filter(s=>snapshot.status[s]==="error");
  const loading=definition.sources.filter(s=>snapshot.status[s]==="loading");
  const ready=!problems.length&&!loading.length&&snapshot.connected===true;
  const fingerprint=JSON.stringify({type,filters});
  const dirty=Boolean(generated&&fingerprint!==inputAtGeneration);
  const newData=Boolean(generated&&snapshot.revision>revisionAtGeneration);
  const section=generated?.sections.find(s=>s.id===sectionId)||generated?.sections[0];
  const canExport=Boolean(generated&&ready&&!dirty);
  useEffect(()=>{if(generated&&REPORT_CATALOG.find(d=>d.id===generated.type)!.sources.some(s=>snapshot.status[s]==="error"))setGenerated(null);},[snapshot.status,generated]);
  const data=snapshot.data;
  const isMonitoring=type==="monitoring"||type==="programs";
  const isPopulation=type==="population"||type==="population-summary";
  const showPurok=["emergencies","rescue","heatmap","population","population-summary","residents","monitoring","programs"].includes(type);
  const showPriority=type==="emergencies"||type==="heatmap";
  const statusOptions=useMemo(()=>{
    if(type==="monitoring")return ["Pending","Done","Referred","Cancelled","Overdue"];
    if(type==="rescue")return ["New","Previous"];
    if(type==="population")return ["active","inactive","relocated","deceased"];
    if(type==="population-summary"||type==="programs"||type==="audit"||type==="complete")return [];
    const values=type==="emergencies"?data.emergencies.map(e=>e.status):type==="heatmap"?data.incidentAnalytics.map(e=>e.status):type==="residents"?data.users.map(u=>u.accountStatus||u.status||"Not recorded"):type==="responders"?[...data.responders.map(r=>r.accountStatus),...data.respondentApplications.map(a=>a.status),...data.respondentInvitations.map(i=>i.status)]:type==="directory"?["active","inactive"]:type==="announcements"?["published","draft","archived"]:type==="notifications"?data.notifications.map(n=>n.status):[];
    return [...new Set(values)].sort();
  },[type,data]);
  const householdOptions=data.households.map(h=>({id:h.id,name:`${h.householdName} • ${h.purokId}`,search:`${h.householdName} ${h.id} ${h.householdHeadName} ${h.address} ${h.purokId}`}));
  const memberOptions=data.inhabitants.filter(p=>!filters.household||p.householdId===filters.household).map(p=>({id:p.id,name:p.fullName,search:`${p.fullName} ${p.id}`}));
  const programOptions=[...data.monitoringPrograms.map(p=>({id:p.id,name:p.name,search:`${p.name} ${p.category}`})),...[...new Set(data.monitoringCases.map(c=>c.program))].filter(name=>!data.monitoringPrograms.some(p=>p.name===name||p.aliases?.includes(name))).map(name=>({id:name,name,search:name}))];
  const respondentOptions=data.responders.map(r=>({id:r.authUid||r.id,name:r.name,search:`${r.name} ${r.email}`}));
  function update<K extends keyof ReportFilters>(key:K,value:ReportFilters[K]){setFilters(f=>({...f,[key]:value,...(key==="household"?{member:""}:{})}));}
  function chooseReport(next:ReportType){setType(next);setFilters(f=>({...DEFAULT_REPORT_FILTERS,startDate:f.startDate,endDate:f.endDate,search:f.search}));setGenerated(null);setMessage("");}
  function generate(){
    if(!ready)return;
    try{const report=buildGeneratedReport(type,data,filters);setGenerated(report);setInputAtGeneration(fingerprint);setRevisionAtGeneration(snapshot.revision);setSectionId(report.sections[0]?.id||"");setView("overview");setMessage("");requestAnimationFrame(()=>preview.current?.scrollIntoView({behavior:"smooth",block:"start"}));}
    catch(error){setMessage(error instanceof Error?error.message:"Unable to generate this report.");}
  }
  function exportReport(kind:"print"|"csv",onlySection=false){
    if(!generated||!canExport)return;
    try{const report=onlySection&&section?selectReportSection(generated,section.id):generated;kind==="print"?printGeneratedReport(report):downloadReportCsv(report);setMessage("");}
    catch(error){setMessage(error instanceof Error?error.message:"Unable to export this report.");}
  }
  function selectField(key:keyof ReportFilters,title:string,options:Array<string|{value:string;label:string}>) {
    return <TextField select label={title} value={filters[key]||""} onChange={e=>update(key,e.target.value)} fullWidth><MenuItem value="">All</MenuItem>{options.map(o=>{const value=typeof o==="string"?o:o.value;return <MenuItem key={value} value={value}>{typeof o==="string"?(key==="status"?titleCase(o):o):o.label}</MenuItem>;})}</TextField>;
  }
  function picker(key:keyof ReportFilters,title:string,options:Array<{id:string;name:string;search:string}>) {
    return <Autocomplete options={options} value={options.find(o=>o.id===filters[key])||null} isOptionEqualToValue={(a,b)=>a.id===b.id} getOptionLabel={o=>o.name} filterOptions={(options,state)=>options.filter(o=>o.search.toLowerCase().includes(state.inputValue.toLowerCase()))} onChange={(_,v)=>update(key,v?.id||"")} renderInput={params=><TextField {...params} label={title} placeholder="All"/>}/>;
  }
  const extraFilters=isPopulation||isMonitoring||type==="rescue";
  return <div className="rc-page">
    <header className="rc-header"><div><p className="rc-eyebrow">ADMINISTRATION / REPORTS</p><h1>Reports center</h1><p>Choose a report, set your filters, then preview, export or print.</p></div><div className={`rc-sync ${ready?"is-ready":""}`} role="status">{ready?<CheckCircleOutlineRounded/>:snapshot.connected===false?<CloudOffOutlined/>:<CircularProgress size={18}/>}<span>{ready?"Report data ready":problems.length?"Some sources unavailable":snapshot.connected===false?"Waiting for connection":"Loading report data"}</span></div></header>
    <div className="rc-workspace"><aside className="rc-sidebar"><p className="rc-step">1 <span>Choose a report</span></p><nav aria-label="Report categories">{groups.map(group=><div key={group} className="rc-nav-group"><p>{group}</p>{REPORT_CATALOG.filter(d=>d.group===group).map(d=><button key={d.id} type="button" className={type===d.id?"is-selected":""} aria-current={type===d.id?"page":undefined} onClick={()=>chooseReport(d.id)}><ReportIcon type={d.id}/><span>{d.shortTitle}</span></button>)}</div>)}</nav></aside>
    <main className="rc-main"><div className="rc-mobile-picker"><TextField select fullWidth label="Choose a report" value={type} onChange={e=>chooseReport(e.target.value as ReportType)}>{REPORT_CATALOG.map(d=><MenuItem key={d.id} value={d.id}>{d.shortTitle}</MenuItem>)}</TextField></div>
      <section className="rc-panel rc-filter-panel" aria-label="Report filters"><div className="rc-panel-heading"><div><p className="rc-step">2 <span>Set report filters</span></p><h2>{definition.title}</h2><p>{definition.description}</p></div><div className="rc-report-icon"><ReportIcon type={type}/></div></div>
      <div className="rc-filter-body">{!definition.static&&<div className="rc-presets" aria-label="Reporting period">{[["all","All dates"],["today","Today"],["month","This month"],["quarter","This quarter"],["year","This year"]].map(([value,title])=>{const dates=presetDates(value);return <button key={value} className={filters.startDate===dates.startDate&&filters.endDate===dates.endDate?"is-selected":""} onClick={()=>setFilters(f=>({...f,...dates}))}>{title}</button>;})}</div>}
      <div className="rc-primary-filters"><TextField label="Search records" placeholder="Name, record ID or keyword" value={filters.search} onChange={e=>update("search",e.target.value)} fullWidth InputProps={{startAdornment:<InputAdornment position="start"><SearchRounded/></InputAdornment>}}/>{!definition.static&&<><TextField label="Start date" type="date" InputLabelProps={{shrink:true}} value={filters.startDate} onChange={e=>update("startDate",e.target.value)}/><TextField label="End date" type="date" InputLabelProps={{shrink:true}} value={filters.endDate} onChange={e=>update("endDate",e.target.value)} error={Boolean(filters.startDate&&filters.endDate&&filters.startDate>filters.endDate)}/></>}</div>
      {(showPurok||statusOptions.length>0||showPriority||type==="monitoring")&&<div className="rc-secondary-filters">{showPurok&&selectField("purok","Purok",[...BUNUANAN_PUROKS,"Unassigned"])}{statusOptions.length>0&&selectField("status",type==="monitoring"?"Activity status":type==="rescue"?"Report group":"Record status",statusOptions)}{showPriority&&selectField("priority","SOS urgency",[{value:"CRITICAL",label:"Critical SOS"},{value:"MEDIUM",label:"Moderate SOS"},{value:"HIGH",label:"High priority SOS"},{value:"LOW",label:"Low priority SOS"}])}{type==="monitoring"&&<TextField select label="Filter activities by" value={filters.activityDate||"scheduled"} onChange={e=>update("activityDate",e.target.value as "scheduled"|"actual")}><MenuItem value="scheduled">Scheduled date</MenuItem><MenuItem value="actual">Actual date</MenuItem></TextField>}</div>}
      {extraFilters&&<Accordion className="rc-more-filters" disableGutters elevation={0}><AccordionSummary expandIcon={<ExpandMoreRounded/>}>More filters</AccordionSummary><AccordionDetails><div className="rc-secondary-filters">{(isPopulation||isMonitoring)&&<>{picker("household","Household",householdOptions)}{picker("member","Household member",memberOptions)}</>}{isMonitoring&&<>{picker("program","Program",programOptions)}{selectField("scope","Monitoring scope",[{value:"person",label:"Individual"},{value:"household",label:"Household"}])}{selectField("staff","Assigned staff",[...new Set(data.monitoringCases.flatMap(c=>[c.assignedTo,...Object.values(c.activities||{}).map(a=>a.context?.assignedTo||"")]).filter(Boolean))].sort())}{selectField("condition","Health condition or focus",[...new Set(data.monitoringCases.flatMap(c=>[c.condition,...Object.values(c.activities||{}).map(a=>a.context?.condition||"")]).filter(Boolean))].sort())}</>}{isPopulation&&<>{selectField("sex","Sex",[{value:"male",label:"Male"},{value:"female",label:"Female"}])}{selectField("sector","Population sector",SECTORS.map(([value,label])=>({value,label})))}</>}{type==="rescue"&&picker("respondent","Respondent folder",respondentOptions)}</div></AccordionDetails></Accordion>}
      <p className="rc-date-note">{definition.dateNote}</p>
      {Object.entries(filters).some(([key,value])=>value&&!["activityDate","startDate","endDate"].includes(key))&&<div className="rc-filter-chips">{Object.entries(filters).filter(([key,value])=>value&&!["activityDate","startDate","endDate"].includes(key)).map(([key,value])=><Chip key={key} label={describeReportFilter(key as keyof ReportFilters,String(value),data)} onDelete={()=>update(key as keyof ReportFilters,"")}/>)}</div>}
      </div><div className="rc-filter-footer"><Button startIcon={<RefreshRounded/>} onClick={()=>{setFilters({...DEFAULT_REPORT_FILTERS});setMessage("");}}>Reset filters</Button><Button variant="contained" disableElevation startIcon={<AssessmentOutlined/>} onClick={generate} disabled={!ready}>Generate report</Button></div></section>
      {message&&<Alert severity="error" onClose={()=>setMessage("")}>{message}</Alert>}
      {problems.length>0&&<Alert severity="error" action={<Button onClick={()=>setRetry(v=>v+1)}>Retry</Button>}>Unable to load {problems.map(s=>REPORT_SOURCE_LABELS[s]).join(", ")}. This report cannot be generated until these sources are available.</Alert>}
      {snapshot.connected===false&&<Alert severity="warning">The database connection is unavailable. Generation and exports will resume when connected.</Alert>}
      {!problems.length&&loading.length>0&&<Alert severity="info" action={slow?<Button onClick={()=>setRetry(v=>v+1)}>Retry</Button>:undefined}>{slow?"Still waiting for":"Loading"} {loading.map(s=>REPORT_SOURCE_LABELS[s]).join(", ")}.</Alert>}
      <section ref={preview} className="rc-panel rc-preview" aria-label="Report preview"><div className="rc-preview-heading"><div><p className="rc-step">3 <span>Preview and export</span></p><h2>{generated?generated.title:"Your report preview"}</h2>{generated&&<p>{generated.periodLabel} • {generated.sections.length} sections • {generated.totalRows.toLocaleString()} table rows</p>}</div>{generated&&<div className="rc-actions"><Button variant="outlined" startIcon={<DownloadRounded/>} disabled={!canExport} onClick={()=>exportReport("csv")}>Export CSV</Button><Button variant="contained" disableElevation startIcon={<PrintRounded/>} disabled={!canExport} onClick={()=>exportReport("print")}>Print / Save PDF</Button></div>}</div>
      {!generated?<div className="rc-empty"><div><AssessmentOutlined/></div><h3>Ready when you are</h3><p>Generate {definition.shortTitle.toLowerCase()} to review the records before printing.</p><span>Uses {definition.sources.length} report data sources</span></div>:<>
      {dirty&&<Alert severity="warning" action={<Button disabled={!ready} onClick={generate}>Update report</Button>}>Filters changed. Update the report to enable exports for these filters.</Alert>}
      {!dirty&&newData&&<Alert severity="info" action={<Button disabled={!ready} onClick={generate}>Refresh report</Button>}>New data is available. This preview and its exports retain the generated snapshot.</Alert>}
      <div className="rc-metrics">{generated.metrics.map(m=><article key={m.label}><span>{m.label}</span><strong>{m.value}</strong>{m.helper&&<small>{m.helper}</small>}</article>)}</div>
      <div className="rc-preview-tabs" role="tablist" aria-label="Preview view"><button role="tab" aria-selected={view==="overview"} onClick={()=>setView("overview")}>Report contents</button><button role="tab" aria-selected={view==="tables"} onClick={()=>setView("tables")}>View records</button></div>
      {view==="overview"?<div className="rc-contents" role="tabpanel"><p>Open a section to review its records. Printing and CSV include every matching row across all sections.</p><div>{generated.sections.map((s,index)=><button key={s.id} onClick={()=>{setSectionId(s.id);setView("tables");}}><span className="rc-section-number">{String(index+1).padStart(2,"0")}</span><span><strong>{s.title}</strong><small>{s.group}</small></span><span className="rc-count">{s.rows.length.toLocaleString()}</span></button>)}</div></div>:section&&<div className="rc-records" role="tabpanel"><div className="rc-records-toolbar"><TextField select label="Report section" value={section.id} onChange={e=>setSectionId(e.target.value)}>{generated.sections.map(s=><MenuItem value={s.id} key={s.id}>{s.title} ({s.rows.length})</MenuItem>)}</TextField><Button startIcon={<PrintRounded/>} disabled={!canExport} onClick={()=>exportReport("print",true)}>Print this section</Button></div><SectionTable key={section.id} section={section}/></div>}
      <div className="rc-preview-notes">{generated.notes.map(n=><p key={n}>{n}</p>)}<p>Generated {new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"}).format(new Date(generated.generatedAt))} • Philippine time</p></div></>}
      </section>
      <Accordion className="rc-source-panel" disableGutters elevation={0}><AccordionSummary expandIcon={<ExpandMoreRounded/>}>Data sources • {definition.sources.filter(s=>snapshot.status[s]==="ready").length} of {definition.sources.length} ready</AccordionSummary><AccordionDetails><ul>{definition.sources.map(s=><li key={s}><span>{REPORT_SOURCE_LABELS[s]}</span><span>{snapshot.status[s]==="ready"?`${data[s].length} records loaded`:snapshot.status[s]==="error"?`Unavailable: ${snapshot.errors[s]}`:"Loading"}</span></li>)}</ul><Button onClick={()=>setRetry(v=>v+1)} startIcon={<RefreshRounded/>}>Reload sources</Button></AccordionDetails></Accordion>
    </main></div>
  </div>;
}
