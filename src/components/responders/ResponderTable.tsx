import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Responder } from "../../types";
import StatusBadge from "./StatusBadge";

export default function ResponderTable({ responders }: { responders: Responder[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>Respondent</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Position</TableCell>
            <TableCell>Barangay / service area</TableCell>
            <TableCell>Availability</TableCell>
            <TableCell>Account</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {responders.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>
                <Typography fontWeight={750}>{item.name}</Typography>
                <Typography color="text.secondary" fontSize={12}>{item.email}</Typography>
              </TableCell>
              <TableCell>{item.contact || "—"}</TableCell>
              <TableCell>{item.position || "—"}</TableCell>
              <TableCell>
                <Typography fontSize={13}>{item.assignedBarangayId || "—"}</Typography>
                <Typography color="text.secondary" fontSize={12}>{item.serviceArea || "—"}</Typography>
              </TableCell>
              <TableCell><StatusBadge status={item.availability} /></TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={item.accountStatus.toUpperCase()}
                  color={item.accountStatus === "active" ? "success" : item.accountStatus === "suspended" ? "warning" : "error"}
                  variant="outlined"
                />
              </TableCell>
            </TableRow>
          ))}
          {responders.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 7 }}>
                <Typography fontWeight={750}>No respondents registered</Typography>
                <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                  Pre-authorize an exact respondent email so the person can register in Android.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
