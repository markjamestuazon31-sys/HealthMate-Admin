import { GroupsOutlined, ArrowForwardRounded, CloseRounded } from "@mui/icons-material";
import { Box, Button, Chip, IconButton, Paper, Snackbar, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { deriveBackupRequests } from "../../services/backupRequestService";
import { listenEmergencies } from "../../services/emergencyService";
import type { BackupRequest } from "../../types";
import { EmergencyPriorityChip } from "../emergency/EmergencyStatusChip";

/**
 * Floating toast for newly opened backup requests (same UX pattern as SOS alerts).
 * Listens to live emergencies, derives open backup requests, and surfaces only NEW ones.
 */
export default function BackupRequestRealtimeNotifier() {
  const navigate = useNavigate();
  const initialized = useRef(false);
  const knownIds = useRef(new Set<string>());
  const [latest, setLatest] = useState<BackupRequest | null>(null);

  useEffect(
    () =>
      listenEmergencies((emergencies) => {
        const open = deriveBackupRequests(emergencies);
        const currentIds = new Set(open.map((item) => item.id));

        if (!initialized.current) {
          knownIds.current = currentIds;
          initialized.current = true;
          return;
        }

        const added = open
          .filter((item) => !knownIds.current.has(item.id))
          .sort((a, b) => b.requestedAt - a.requestedAt);

        knownIds.current = currentIds;

        // Drop knowledge of fulfilled/closed so a re-request can alert again later
        for (const id of [...knownIds.current]) {
          if (!currentIds.has(id)) knownIds.current.delete(id);
        }
        knownIds.current = currentIds;

        if (!added.length) return;
        setLatest(added[0]);
      }),
    [],
  );

  function openCase() {
    if (!latest) return;
    const id = latest.incidentId;
    setLatest(null);
    navigate(`/emergencies/${id}`);
  }

  const needLine = latest
    ? [latest.specialty, latest.need, latest.notes].filter(Boolean).join(" · ")
    : "";

  return (
    <Snackbar
      open={Boolean(latest)}
      onClose={(_, reason) => {
        if (reason !== "clickaway") setLatest(null);
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      // Sit below the SOS toast if both appear; SOS uses mt ~7.5–8.5
      sx={{ mt: { xs: 7.5, md: 8.5 }, mr: { xs: 0, sm: 1 } }}
    >
      <Paper
        role="alert"
        aria-live="assertive"
        sx={{
          width: { xs: "calc(100vw - 28px)", sm: 460 },
          overflow: "hidden",
          border: `1px solid ${alpha("#B42318", 0.28)}`,
          boxShadow: "0 24px 60px rgba(16,24,40,0.24)",
        }}
      >
        <Box sx={{ px: 2, py: 1.1, color: "white", bgcolor: "#9A3412" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GroupsOutlined fontSize="small" />
            <Typography fontWeight={900} fontSize={15} sx={{ flexGrow: 1 }}>
              BACKUP REQUEST
            </Typography>
            <IconButton
              size="small"
              onClick={() => setLatest(null)}
              aria-label="Dismiss backup request alert"
              sx={{ color: "white" }}
            >
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {latest && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              <Chip
                size="small"
                color="error"
                label="BACKUP NEEDED"
                sx={{ fontWeight: 850 }}
              />
              <EmergencyPriorityChip priority={latest.priority} />
              {latest.incidentStatus && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={String(latest.incidentStatus).replace(/_/g, " ")}
                />
              )}
            </Stack>

            <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
              {latest.requesterName || "A responder"}
              {latest.teamRole ? ` · ${latest.teamRole}` : ""} needs backup
            </Typography>

            <Typography color="text.secondary" fontSize={14.5} sx={{ mt: 0.55, lineHeight: 1.5 }}>
              Patient: {latest.patientName || "Unknown"}
              {latest.area ? ` · ${latest.area}` : ""}
              {" · "}
              {latest.activeResponderCount} active on scene
              {" · "}
              {new Date(latest.requestedAt).toLocaleTimeString()}
            </Typography>

            {needLine ? (
              <Box
                sx={{
                  mt: 1.15,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: alpha("#2563EB", 0.08),
                  border: `1px solid ${alpha("#2563EB", 0.15)}`,
                }}
              >
                <Typography fontWeight={750} fontSize={12.5} color="text.secondary">
                  What they need
                </Typography>
                <Typography fontSize={14} sx={{ mt: 0.25 }}>
                  {needLine}
                </Typography>
              </Box>
            ) : null}

            <Button
              fullWidth
              variant="contained"
              color="error"
              endIcon={<ArrowForwardRounded />}
              onClick={openCase}
              sx={{ mt: 1.8 }}
            >
              Open emergency command
            </Button>
          </Box>
        )}
      </Paper>
    </Snackbar>
  );
}
