import { BlockOutlined, CheckCircleOutline, DeleteOutline, RefreshOutlined } from "@mui/icons-material";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  reactivateRegisteredRespondent,
  setInvitationStatus,
} from "../../services/respondentInvitationService";
import type { RespondentInvitation } from "../../types";

function statusColor(
  status: RespondentInvitation["status"],
): "success" | "warning" | "error" | "info" {
  if (status === "REGISTERED") return "success";
  if (status === "INVITED") return "info";
  if (status === "SUSPENDED") return "warning";
  return "error";
}

export default function InvitationTable({ invitations }: { invitations: RespondentInvitation[] }) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function run(invitation: RespondentInvitation, action: () => Promise<void>) {
    setBusyId(invitation.id);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the respondent invitation.");
    } finally {
      setBusyId("");
    }
  }

  function revoke(invitation: RespondentInvitation) {
    if (!window.confirm(`Revoke respondent authorization for ${invitation.normalizedEmail}?`)) return;
    void run(invitation, () => setInvitationStatus(invitation, "REVOKED"));
  }

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              <TableCell>Respondent</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Barangay / service area</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Controls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invitations.map((item) => {
              const busy = busyId === item.id;
              return (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography fontWeight={750}>{item.fullName}</Typography>
                    <Typography color="text.secondary" fontSize={12}>
                      {item.normalizedEmail}<br />{item.phone}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.position}</TableCell>
                  <TableCell>
                    <Typography fontSize={13}>{item.assignedBarangayId}</Typography>
                    <Typography color="text.secondary" fontSize={12}>{item.serviceArea || "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={item.status} color={statusColor(item.status)} variant="outlined" />
                  </TableCell>
                  <TableCell>{new Date(item.updatedAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    {busy ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {(item.status === "INVITED" || item.status === "REGISTERED") && (
                          <Button
                            size="small"
                            color="warning"
                            startIcon={<BlockOutlined />}
                            onClick={() => void run(item, () => setInvitationStatus(item, "SUSPENDED"))}
                          >
                            Suspend
                          </Button>
                        )}
                        {item.status === "SUSPENDED" && item.registeredUid && (
                          <Button
                            size="small"
                            startIcon={<RefreshOutlined />}
                            onClick={() => void run(item, () => reactivateRegisteredRespondent(item))}
                          >
                            Reactivate
                          </Button>
                        )}
                        {(item.status === "SUSPENDED" || item.status === "REVOKED") && !item.registeredUid && (
                          <Button
                            size="small"
                            startIcon={<RefreshOutlined />}
                            onClick={() => void run(item, () => setInvitationStatus(item, "INVITED"))}
                          >
                            Re-invite
                          </Button>
                        )}
                        {item.status === "REVOKED" && item.registeredUid && (
                          <Button
                            size="small"
                            startIcon={<RefreshOutlined />}
                            onClick={() => void run(item, () => reactivateRegisteredRespondent(item))}
                          >
                            Reactivate
                          </Button>
                        )}
                        {item.status !== "REVOKED" && (
                          <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => revoke(item)}>
                            Revoke
                          </Button>
                        )}
                        {item.status === "REGISTERED" && <CheckCircleOutline color="success" fontSize="small" />}
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 7 }}>
                  <Typography fontWeight={750}>No respondent account records</Typography>
                  <Typography color="text.secondary" fontSize={13}>
                    Create a verified @respondent.com login from the Respondent Accounts page.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
