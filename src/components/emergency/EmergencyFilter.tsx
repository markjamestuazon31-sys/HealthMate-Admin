import { SearchOutlined } from "@mui/icons-material";
import { Box, Button, Chip, InputAdornment, MenuItem, Paper, Stack, TextField } from "@mui/material";
import { sosUrgencyLabel } from "../../services/sosUrgency";
const statuses = ["PENDING","ACCEPTED","RESPONDING","EN_ROUTE","ON_SCENE","AGENCY_CONTACTED","RESCUE_IN_PROGRESS","REPORT_SUBMITTED","ADMIN_REVIEWED","CLOSED","CANCELLED"];
interface Props {
  search: string; setSearch: (v:string)=>void; status:string; setStatus:(v:string)=>void;
  urgency?:string; setUrgency?:(v:string)=>void; sort?:string; setSort?:(v:string)=>void;
}
export default function EmergencyFilter({search,setSearch,status,setStatus,urgency="",setUrgency,sort="priority",setSort}:Props) {
  const reset = () => {setSearch("");setStatus("");setUrgency?.("");setSort?.("priority");};
  return <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, boxShadow: "none" }}>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2,1fr)",lg:"minmax(260px,2fr) repeat(3,minmax(160px,1fr))"},gap:2}}>
      <TextField label="Search incidents" placeholder="Name, incident ID, contact or location" value={search} onChange={e=>setSearch(e.target.value)}
        InputProps={{startAdornment:<InputAdornment position="start"><SearchOutlined /></InputAdornment>}} />
      {setUrgency && <TextField select label="SOS urgency" value={urgency} onChange={e=>setUrgency(e.target.value)}>
        <MenuItem value="">All SOS levels</MenuItem>{["CRITICAL","MEDIUM","HIGH","LOW"].map(v=><MenuItem key={v} value={v}>{sosUrgencyLabel(v)}</MenuItem>)}
      </TextField>}
      <TextField select label="Response status" value={status} onChange={e=>setStatus(e.target.value)}><MenuItem value="">All statuses</MenuItem>{statuses.map(v=><MenuItem key={v} value={v}>{v.replace(/_/g," ")}</MenuItem>)}</TextField>
      {setSort && <TextField select label="Sort by" value={sort} onChange={e=>setSort(e.target.value)}><MenuItem value="priority">Urgency and waiting time</MenuItem><MenuItem value="newest">Newest first</MenuItem><MenuItem value="oldest">Oldest first</MenuItem></TextField>}
    </Box>
    {(search || status || urgency || sort !== "priority") && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{mt:2}}>
      {search && <Chip label={`Search: ${search}`} onDelete={()=>setSearch("")} />}
      {urgency && <Chip label={sosUrgencyLabel(urgency)} onDelete={()=>setUrgency?.("")} />}
      {status && <Chip label={status.replace(/_/g," ")} onDelete={()=>setStatus("")} />}
      <Button onClick={reset}>Reset filters</Button>
    </Stack>}
  </Paper>;
}
