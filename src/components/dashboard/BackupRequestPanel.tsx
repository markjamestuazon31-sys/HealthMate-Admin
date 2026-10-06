import {
  GroupsOutlined,
  NotificationsActiveRounded,
  OpenInNewRounded,
  CheckCircleOutlineRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  markBackupFulfilled,
  notifyAllRespondersOfBackup,
} from "../../services/backupRequestService";
import type { BackupRequest, Responder } from "../../types";
import { EmergencyPriorityChip } from "../emergency/EmergencyStatusChip";

const ACCENT = "#B42318";

export default function BackupRequestPanel({
  requests,
  responders,
}: {
  requests: BackupRequest[];
  responders: Responder[];
}) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleNotify(request: BackupRequest) {
    setBusyId(request.id);
    setError("");
    setSuccess("");
    try {
      const result = await notifyAllRespondersOfBackup(request, responders, {
        availableOnly: false,
      });
      setSuccess(
        `Notified ${result.notifiedCount} respondent${result.notifiedCount === 1 ? "" : "s"} about this backup request.`,
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to notify respondents.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleFulfilled(request: BackupRequest) {
    setBusyId(request.id);
    setError("");
    setSuccess("");
    try {
      await markBackupFulfilled(request);
      setSuccess("Backup request marked as fulfilled.");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update backup request.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <Card variant="outlined" sx={{ boxShadow: "none" }}>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <GroupsOutlined color="action" />
            <Typography variant="h6">Backup requests</Typography>
          </Stack>
          <Typography color="text.secondary">
            No open backup requests. When a responder taps Request backup on an
            active SOS, it appears here so you can notify other respondents.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        boxShadow: "none",
        borderColor: alpha(ACCENT, 0.35),
        bgcolor: alpha(ACCENT, 0.03),
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <GroupsOutlined sx={{ color: ACCENT }} />
            <Typography variant="h6">Backup requests</Typography>
            <Chip
              size="small"
              color="error"
              label={requests.length}
              sx={{ fontWeight: 850 }}
            />
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 1.5 }}
            onClose={() => setSuccess("")}
          >
            {success}
          </Alert>
        )}

        <Stack spacing={1.5}>
          {requests.map((request) => {
            const busy = busyId === request.id;
            const needLine = [
              request.specialty,
              request.need,
              request.notes,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Box
                key={request.id}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ md: "flex-start" }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                      sx={{ mb: 0.75 }}
                    >
                      <Chip
                        size="small"
                        color={
                          request.status === "NOTIFIED" ? "warning" : "error"
                        }
                        label={
                          request.status === "NOTIFIED"
                            ? "NOTIFIED"
                            : "BACKUP NEEDED"
                        }
                        sx={{ fontWeight: 850 }}
                      />
                      <EmergencyPriorityChip priority={request.priority} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={request.incidentStatus.replace(/_/g, " ")}
                      />
                    </Stack>

                    <Typography fontWeight={850}>
                      {request.requesterName || request.requesterUid}
                      {request.teamRole
                        ? ` · ${request.teamRole}`
                        : ""}{" "}
                      needs backup
                    </Typography>

                    <Typography color="text.secondary" fontSize={13.5} sx={{ mt: 0.35 }}>
                      Patient: {request.patientName || "Unknown"}
                      {request.area ? ` · ${request.area}` : ""}
                      {" · "}
                      {request.activeResponderCount} active on scene team
                      {" · "}
                      {new Date(request.requestedAt).toLocaleString()}
                    </Typography>

                    {needLine ? (
                      <Alert severity="info" sx={{ mt: 1.25 }} icon={false}>
                        <Typography fontWeight={750} fontSize={13}>
                          What they need
                        </Typography>
                        <Typography fontSize={13.5} sx={{ whiteSpace: "pre-wrap" }}>
                          {needLine}
                        </Typography>
                      </Alert>
                    ) : (
                      <Typography
                        color="text.secondary"
                        fontSize={13}
                        sx={{ mt: 0.75 }}
                      >
                        No specialty notes provided by the requester.
                      </Typography>
                    )}
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ flexShrink: 0 }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewRounded />}
                      onClick={() =>
                        navigate(
                          `/emergencies/${encodeURIComponent(request.incidentId)}`,
                        )
                      }
                    >
                      Open case
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      startIcon={
                        busy ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <NotificationsActiveRounded />
                        )
                      }
                      disabled={busy}
                      onClick={() => handleNotify(request)}
                    >
                      Notify all respondents
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<CheckCircleOutlineRounded />}
                      disabled={busy}
                      onClick={() => handleFulfilled(request)}
                    >
                      Mark fulfilled
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
