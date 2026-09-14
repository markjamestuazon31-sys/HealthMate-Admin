import { ArrowForwardRounded, LocationOnOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { Emergency } from "../../types";
import EmergencyAvatar from "../emergency/EmergencyAvatar";
import { EmergencyPriorityChip, EmergencyStatusChip, isTerminalStatus } from "../emergency/EmergencyStatusChip";

export default function RecentEmergencyTable({ emergencies }: { emergencies: Emergency[] }) {
  const navigate = useNavigate();
  const recent = emergencies.slice(0, 6);

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
      <Table size="small" sx={{ minWidth: 820 }}>
        <TableHead>
          <TableRow>
            <TableCell>Resident</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Area</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Received</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {recent.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <EmergencyAvatar name={item.patientName} profileImage={item.patientProfile?.profileImage} size={40} active={!isTerminalStatus(item.status)} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={820} noWrap>{item.patientName || item.patientUid || "Unknown"}</Typography>
                    <Typography color="text.secondary" fontSize={12} noWrap>{item.patientPhone || item.type}</Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell><EmergencyPriorityChip priority={item.priority} /></TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.65} alignItems="center">
                  <LocationOnOutlined color="action" sx={{ fontSize: 17 }} />
                  <Typography fontSize={13}>{item.locationSummary.barangayName || item.assignedBarangayId || "Unassigned"}</Typography>
                </Stack>
              </TableCell>
              <TableCell><EmergencyStatusChip status={item.status} /></TableCell>
              <TableCell><Typography fontSize={12.5}>{new Date(item.createdAt).toLocaleString()}</Typography></TableCell>
              <TableCell align="right"><Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate(`/emergencies/${item.id}`)}>Open</Button></TableCell>
            </TableRow>
          ))}
          {recent.length === 0 && (
            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No emergency records yet.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
