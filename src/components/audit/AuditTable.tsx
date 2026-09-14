import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { AuditLog } from "../../types";

export default function AuditTable({ logs }: { logs: AuditLog[] }) {
  return (
    <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell>Action</TableCell>
            <TableCell>Performed by</TableCell>
            <TableCell>Details</TableCell>
            <TableCell>Date and time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 7 }}>
                <Typography fontWeight={750}>No audit activity recorded</Typography>
                <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                  Administrative actions will appear here when logging is enabled.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell><Typography fontWeight={700}>{log.action}</Typography></TableCell>
                <TableCell>{log.performedBy || log.userId || "System"}</TableCell>
                <TableCell>{log.details || "—"}</TableCell>
                <TableCell>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
