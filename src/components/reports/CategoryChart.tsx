import { Box, Typography } from "@mui/material";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Emergency } from "../../types";

const chartColors = ["#146C94", "#E4572E", "#2E7D32", "#7E57C2", "#ED6C02", "#5D6D7E"];

export default function CategoryChart({ data }: { data: Emergency[] }) {
  const categories = data.reduce<Record<string, number>>((result, item) => {
    result[item.type] = (result[item.type] ?? 0) + 1;
    return result;
  }, {});
  const chartData = Object.entries(categories).map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return (
      <Box sx={{ height: 320, display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">No emergency categories are available yet.</Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={2}>
          {chartData.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
