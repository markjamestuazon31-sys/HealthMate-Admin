import { CheckCircleOutline, CrisisAlertOutlined, PriorityHighOutlined } from "@mui/icons-material";
import { Box } from "@mui/material";
import type { Emergency } from "../../types";
import StatCard from "../dashboard/StatCard";

export default function EmergencyStatistics({ data }: { data: Emergency[] }) {
  const active = data.filter((item) => item.status !== "CLOSED" && item.status !== "CANCELLED").length;
  const highPriority = data.filter((item) => item.priority === "HIGH" || item.priority === "CRITICAL").length;
  const resolved = data.filter((item) => item.status === "CLOSED").length;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
      <StatCard title="Total emergencies" value={data.length} helper="All recorded incidents" icon={<CrisisAlertOutlined />} color="#146C94" />
      <StatCard title="Active and high priority" value={active} helper={`${highPriority} high priority`} icon={<PriorityHighOutlined />} color="#C62828" />
      <StatCard title="Resolved" value={resolved} helper="Completed incident responses" icon={<CheckCircleOutline />} color="#2E7D32" />
    </Box>
  );
}
