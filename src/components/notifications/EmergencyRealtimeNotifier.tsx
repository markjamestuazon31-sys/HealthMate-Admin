import { sosUrgencyLabel, sosUrgencyRank } from "../../services/sosUrgency";
import { ArrowForwardRounded, CloseRounded, NotificationsActiveRounded } from "@mui/icons-material";
import { Box, Button, IconButton, Paper, Snackbar, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listenEmergencies } from "../../services/emergencyService";
import type { Emergency } from "../../types";
import EmergencyAvatar from "../emergency/EmergencyAvatar";
import { EmergencyPriorityChip } from "../emergency/EmergencyStatusChip";

export default function EmergencyRealtimeNotifier() {
  const navigate = useNavigate();
  const initialized = useRef(false);
  const knownIds = useRef(new Set<string>());
  const knownPriorities = useRef(new Map<string,string>());
  const [updated, setUpdated] = useState(false);
  const [latest, setLatest] = useState<Emergency | null>(null);

  useEffect(() => listenEmergencies((items) => {
    const currentIds = new Set(items.map((item) => item.id));
    if (!initialized.current) {
      knownIds.current = currentIds;
      knownPriorities.current = new Map(items.map(item=>[item.id,item.priority]));
      initialized.current = true;
      return;
    }

    const added = items.filter((item) => !knownIds.current.has(item.id)).sort((a, b) => b.createdAt - a.createdAt);
    const changed = items.filter(item=>knownPriorities.current.has(item.id)
      && knownPriorities.current.get(item.id)!==item.priority && !["CLOSED","CANCELLED"].includes(item.status));
    knownIds.current = currentIds;
    knownPriorities.current = new Map(items.map(item=>[item.id,item.priority]));
    const candidates = [...added, ...changed].sort((a,b)=>sosUrgencyRank(b.priority)-sosUrgencyRank(a.priority) || b.createdAt-a.createdAt);
    if (!candidates.length) return;
    const emergency = candidates[0];
    setUpdated(changed.some(item=>item.id===emergency.id));
    setLatest(emergency);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`${sosUrgencyLabel(emergency.priority)}: ${emergency.patientName || "HealthMate user"}`, {
        body: `${sosUrgencyLabel(emergency.priority)} · ${emergency.description}`,
        tag: `healthmate-emergency-${emergency.id}`,
        requireInteraction: true,
      });
      notification.onclick = () => {
        window.focus();
        navigate(`/emergencies/${emergency.id}`);
        notification.close();
      };
    }
  }), [navigate]);

  function openEmergency() {
    if (!latest) return;
    const id = latest.id;
    setLatest(null);
    navigate(`/emergencies/${id}`);
  }

  return (
    <Snackbar
      open={Boolean(latest)}
      onClose={(_, reason) => { if (reason !== "clickaway") setLatest(null); }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: { xs: 7.5, md: 8.5 }, mr: { xs: 0, sm: 1 } }}
    >
      <Paper
        role="alert"
        aria-live="assertive"
        sx={{
          width: { xs: "calc(100vw - 28px)", sm: 460 },
          overflow: "hidden",
          border: `1px solid ${alpha("#D92D20", 0.28)}`,
          boxShadow: "0 24px 60px rgba(16,24,40,0.24)",
        }}
      >
        <Box sx={{ px: 2, py: 1.1, color: "white", bgcolor: latest?.priority === "MEDIUM" ? "#92400E" : "error.main" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotificationsActiveRounded fontSize="small" />
            <Typography fontWeight={900} fontSize={15} sx={{ flexGrow: 1 }}>{updated ? "SOS URGENCY UPDATED" : "NEW SOS ALERT"}</Typography>
            <IconButton size="small" onClick={() => setLatest(null)} aria-label="Dismiss SOS alert" sx={{ color: "white" }}><CloseRounded fontSize="small" /></IconButton>
          </Stack>
        </Box>
        {latest && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <EmergencyAvatar name={latest.patientName} profileImage={latest.patientProfile?.profileImage} size={58} pulse />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="h6" noWrap>{latest.patientName || "Unknown HealthMate user"}</Typography>
                  <EmergencyPriorityChip priority={latest.priority} />
                </Stack>
                <Typography color="text.secondary" fontSize={15} sx={{ mt: 0.55, lineHeight: 1.55 }}>{latest.description}</Typography>
                <Typography color="text.secondary" fontSize={14} sx={{ mt: 0.8 }}>
                  {latest.locationSummary.barangayName || latest.assignedBarangayId || "Location area pending"} · {new Date(latest.createdAt).toLocaleTimeString()}
                </Typography>
              </Box>
            </Stack>
            <Button fullWidth variant="contained" color="error" endIcon={<ArrowForwardRounded />} onClick={openEmergency} sx={{ mt: 1.8 }}>
              Open emergency command
            </Button>
          </Box>
        )}
      </Paper>
    </Snackbar>
  );
}
