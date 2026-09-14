import { AccessTimeRounded, CrisisAlertRounded, HealthAndSafetyOutlined, WarningAmberRounded } from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import EmergencyDialog from "../components/emergency/EmergencyDialog";
import EmergencyFilter from "../components/emergency/EmergencyFilter";
import EmergencyTable from "../components/emergency/EmergencyTable";
import { listenEmergencies } from "../services/emergencyService";
import { compareSosUrgency, sosUrgencyLabel } from "../services/sosUrgency";
import type { Emergency } from "../types";

export default function Emergencies() {
  const [data, setData] = useState<Emergency[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [sort, setSort] = useState("priority");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  const { incidentId } = useParams();
  useEffect(() => {
    setError("");
    return listenEmergencies(setData, () => setError("Some emergency records could not be loaded. Check your connection and admin access."));
  }, [retry]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter(item => (!query || [item.id, item.patientName, item.patientPhone, item.patientProfile?.email,
      item.type, item.description, item.assignedBarangayId, item.locationSummary.barangayName, sosUrgencyLabel(item.priority)]
      .filter(Boolean).join(" ").toLowerCase().includes(query)) && (!status || item.status === status) && (!urgency || item.priority === urgency))
      .sort(sort === "newest" ? (a,b) => b.createdAt-a.createdAt : sort === "oldest" ? (a,b) => a.createdAt-b.createdAt : compareSosUrgency);
  }, [data, search, status, urgency, sort]);
  const active = data.filter(item => !["CLOSED", "CANCELLED", "REPORT_SUBMITTED", "ADMIN_REVIEWED"].includes(item.status));
  const stats = [
    { label: "Ongoing responses", value: active.length, color: "#164E63", background: "#ECFEFF", icon: <HealthAndSafetyOutlined /> },
    { label: "Critical SOS", value: active.filter(item=>item.priority === "CRITICAL").length, color: "#B42318", background: "#FEF3F2", icon: <CrisisAlertRounded /> },
    { label: "Moderate SOS", value: active.filter(item=>item.priority === "MEDIUM").length, color: "#92400E", background: "#FFFBEB", icon: <WarningAmberRounded /> },
    { label: "Awaiting responder", value: active.filter(item=>!Object.values(item.responders ?? {}).some(r=>r.active)).length, color: "#4338CA", background: "#EEF2FF", icon: <AccessTimeRounded /> },
  ];
  const selected = data.find(item=>item.id === incidentId) ?? null;
  return <Stack spacing={2.5} sx={{ "& .MuiButton-root": { minHeight: 44 }, "& .MuiInputBase-root": { fontSize: 16 } }}>
    <PageHeader eyebrow="Emergency operations" title="SOS response workspace"
      description="Review reported urgency, monitor the response team, and follow each incident through to closure."
      action={<Button variant="outlined" onClick={()=>navigate("/incident-heatmap")}>View incident heatmap</Button>} />
    {error && <Alert severity="error" action={<Button onClick={()=>setRetry(v=>v+1)}>Retry</Button>}>{error}</Alert>}
    <Typography fontSize={14} color="text.secondary">Overview of ongoing responses across all records</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 2 }}>
      {stats.map(item=><Card key={item.label} variant="outlined" sx={{ borderRadius: 3, boxShadow: "none" }}><CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: item.background, color: item.color }}>{item.icon}</Box>
          <Box><Typography color="text.secondary" fontSize={14}>{item.label}</Typography><Typography fontSize={28} fontWeight={800}>{item.value}</Typography></Box>
        </Stack>
      </CardContent></Card>)}
    </Box>
    <EmergencyFilter search={search} setSearch={setSearch} status={status} setStatus={setStatus}
      urgency={urgency} setUrgency={setUrgency} sort={sort} setSort={setSort} />
    <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
      <Box><Typography variant="h6">Incident directory</Typography><Typography color="text.secondary" fontSize={14}>{filtered.length} of {data.length} incidents shown</Typography></Box>
      <Typography fontSize={14} color="text.secondary">{sort === "priority" ? "Urgency, then waiting time" : sort === "newest" ? "Newest first" : "Oldest first"}</Typography>
    </Stack>
    <EmergencyTable data={filtered} onView={item=>navigate(`/emergencies/${item.id}`)} />
    <EmergencyDialog emergency={selected} open={Boolean(selected)} close={()=>navigate("/emergencies")} />
  </Stack>;
}
