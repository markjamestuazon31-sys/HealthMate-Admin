import { Box, Typography } from "@mui/material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Emergency } from "../../types";

function buildTrend(emergencies: Emergency[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString(undefined, { weekday: "short" }), alerts: 0 };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  emergencies.forEach((emergency) => {
    const key = new Date(emergency.createdAt).toISOString().slice(0, 10);
    const day = byDay.get(key);
    if (day) day.alerts += 1;
  });
  return days;
}

export default function EmergencyChart({ emergencies }: { emergencies: Emergency[] }) {
  const data = buildTrend(emergencies);

  return (
    <Box sx={{ width: "100%", height: 310 }}>
      {emergencies.length === 0 ? (
        <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
          <Typography color="text.secondary">No emergency activity has been recorded.</Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="emergencyTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#146C94" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#146C94" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E7EDF2" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="alerts"
              stroke="#146C94"
              strokeWidth={3}
              fill="url(#emergencyTrend)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}
