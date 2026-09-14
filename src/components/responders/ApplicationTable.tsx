import {
  OpenInNewOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Button,
  Chip,
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
import type {
  RespondentApplication,
  RespondentApplicationStatus,
} from "../../types";

function statusColor(
  status: RespondentApplicationStatus,
): "info" | "warning" | "success" | "error" | "default" {
  if (status === "approved") return "success";
  if (status === "pending_review" || status === "under_verification") return "info";
  if (status === "additional_documents_required") return "warning";
  if (status === "rejected" || status === "deactivated") return "error";
  return "default";
}

function statusLabel(status: RespondentApplicationStatus) {
  return status.replace(/_/g, " ").toUpperCase();
}

export default function ApplicationTable({
  applications,
  openApplication,
}: {
  applications: RespondentApplication[];
  openApplication: (application: RespondentApplication) => void;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table sx={{ minWidth: 1080 }}>
        <TableHead>
          <TableRow>
            <TableCell>Applicant</TableCell>
            <TableCell>Requested role</TableCell>
            <TableCell>Barangay / organization</TableCell>
            <TableCell>Evidence</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Submitted</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {applications.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
                  <VerifiedUserOutlined color="disabled" sx={{ fontSize: 42 }} />
                  <Typography fontWeight={800}>
                    No respondent applications
                  </Typography>
                  <Typography color="text.secondary" fontSize={13}>
                    Mobile applications will appear here immediately after submission.
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          )}

          {applications.map((application) => (
            <TableRow key={application.id} hover>
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ width: 44, height: 44 }}>
                    {application.fullName?.slice(0, 1).toUpperCase() || "R"}
                  </Avatar>
                  <div>
                    <Typography fontWeight={800}>{application.fullName}</Typography>
                    <Typography color="text.secondary" fontSize={12}>
                      {application.email}
                      <br />
                      {application.phone}
                    </Typography>
                  </div>
                </Stack>
              </TableCell>

              <TableCell>
                <Typography fontSize={13} fontWeight={700}>
                  {application.requestedRole?.replace(/_/g, " ")}
                </Typography>
                <Typography color="text.secondary" fontSize={12}>
                  {application.trainingSummary || "No training summary"}
                </Typography>
              </TableCell>

              <TableCell>
                <Typography fontSize={13}>{application.barangayId || "—"}</Typography>
                <Typography color="text.secondary" fontSize={12}>
                  {application.organization || "Independent applicant"}
                </Typography>
              </TableCell>

              <TableCell>
                <Chip
                  size="small"
                  label="Open review to load ID and certificate"
                  color="info"
                  variant="outlined"
                />
              </TableCell>

              <TableCell>
                <Chip
                  size="small"
                  label={statusLabel(application.status)}
                  color={statusColor(application.status)}
                  variant="outlined"
                />
              </TableCell>

              <TableCell>
                {application.submittedAt
                  ? new Date(application.submittedAt).toLocaleString()
                  : "—"}
              </TableCell>

              <TableCell align="right">
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewOutlined />}
                  onClick={() => openApplication(application)}
                >
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
