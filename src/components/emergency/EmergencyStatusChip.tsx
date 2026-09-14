import { sosUrgencyLabel } from "../../services/sosUrgency";
import { Chip } from "@mui/material";
import type { EmergencyPriority, EmergencyStatus } from "../../types";

export function isTerminalStatus(status: EmergencyStatus) {
  return status === "CLOSED" || status === "CANCELLED";
}

export function EmergencyPriorityChip({ priority }: { priority: EmergencyPriority }) {
  const color = priority === "CRITICAL" || priority === "HIGH" ? "error" : priority === "MEDIUM" ? "warning" : "success";
  return <Chip size="small" color={color} label={sosUrgencyLabel(priority)} sx={{ fontWeight: 750, fontSize: 14, height: 30, letterSpacing: 0 }} />;
}

export function EmergencyStatusChip({ status }: { status: EmergencyStatus }) {
  const color = status === "CANCELLED" ? "default" : status === "CLOSED" || status === "ADMIN_REVIEWED" ? "success" : status === "PENDING" ? "error" : "warning";
  return (
    <Chip
      size="small"
      color={color}
      variant={status === "PENDING" ? "filled" : "outlined"}
      label={status.replace(/_/g, " ")}
      sx={{ fontWeight: 800, letterSpacing: 0.25 }}
    />
  );
}
