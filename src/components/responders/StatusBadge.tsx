import { Chip } from "@mui/material";
import type { ResponderAvailability } from "../../types";

const colors: Record<ResponderAvailability, "success" | "warning" | "default"> = {
  AVAILABLE: "success",
  BUSY: "warning",
  OFF_DUTY: "default",
};

export default function StatusBadge({ status }: { status: ResponderAvailability }) {
  return <Chip label={status.replace("_", " ")} color={colors[status]} size="small" variant="outlined" />;
}
