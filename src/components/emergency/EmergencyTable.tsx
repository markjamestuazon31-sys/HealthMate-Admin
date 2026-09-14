import {
  AccessTimeRounded,
  LocationOnOutlined,
  OpenInNewRounded,
  PeopleAltOutlined,
} from "@mui/icons-material";
import {
  Box,
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
import type { Emergency } from "../../types";
import EmergencyAvatar from "./EmergencyAvatar";
import { EmergencyPriorityChip, EmergencyStatusChip, isTerminalStatus } from "./EmergencyStatusChip";

const STALE_AFTER_MS = 2 * 60 * 1000;

function freshness(updatedAt: number) {
  if (!updatedAt) return { label: "No GPS update", stale: true };
  const delta = Math.max(0, Date.now() - updatedAt);
  if (delta < 60_000) return { label: "Live now", stale: false };
  const minutes = Math.floor(delta / 60_000);
  return { label: `${minutes} min ago`, stale: delta > STALE_AFTER_MS };
}

export default function EmergencyTable({ data, onView }: { data: Emergency[]; onView: (item: Emergency) => void }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 1080 }}>
        <TableHead>
          <TableRow>
            <TableCell>Patient</TableCell>
            <TableCell>Incident</TableCell>
            <TableCell>Live location</TableCell>
            <TableCell>Response</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                <Typography fontWeight={850}>No SOS incidents match the current filters</Typography>
                <Typography color="text.secondary" fontSize={14} sx={{ mt: 0.5 }}>
                  New Android SOS records will appear here in real time.
                </Typography>
              </TableCell>
            </TableRow>
          ) : data.map((item) => {
            const locationFreshness = freshness(item.location.updatedAt);
            const activeTeam = Object.values(item.responders ?? {}).filter((response) => response.active).length;
            const active = !isTerminalStatus(item.status);
            return (
              <TableRow key={item.id} hover sx={{ "& td": { py: 1.65 } }}>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <EmergencyAvatar
                      name={item.patientName}
                      profileImage={item.patientProfile?.profileImage}
                      size={46}
                      active={active}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={850} noWrap>{item.patientName || "Unknown resident"}</Typography>
                      <Typography color="text.secondary" fontSize={14} noWrap>
                        {item.patientPhone || item.patientProfile?.email || item.patientUid || "No contact details"}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack spacing={0.7} alignItems="flex-start">
                    <EmergencyPriorityChip priority={item.priority} />
                    <Typography color="text.secondary" fontSize={14}>{item.urgencyReviewedAt ? "Admin reviewed" : item.reportedUrgency ? "Reported urgency" : "Previous record"}</Typography>
                    <Typography fontWeight={760}>{item.type}</Typography>
                    <Typography color="text.secondary" fontSize={14}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack spacing={0.65}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <LocationOnOutlined color={locationFreshness.stale ? "error" : "success"} fontSize="small" />
                      <Typography fontWeight={750} fontSize={14}>
                        {item.locationSummary.barangayName || item.assignedBarangayId || "Unassigned area"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <AccessTimeRounded color="action" sx={{ fontSize: 16 }} />
                      <Chip
                        size="small"
                        label={locationFreshness.label}
                        color={locationFreshness.stale ? "error" : "success"}
                        variant="outlined"
                        sx={{ height: 28, fontSize: 13, fontWeight: 750 }}
                      />
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <PeopleAltOutlined color="action" fontSize="small" />
                    <Typography fontWeight={850}>{activeTeam}</Typography>
                    <Typography color="text.secondary" fontSize={14}>active</Typography>
                  </Stack>
                  <Typography color="text.secondary" fontSize={14} sx={{ mt: 0.55 }}>
                    {item.recipientCount ?? 0} authorized recipients
                  </Typography>
                </TableCell>
                <TableCell><EmergencyStatusChip status={item.status} /></TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" endIcon={<OpenInNewRounded />} onClick={() => onView(item)}>
                    Open incident
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
