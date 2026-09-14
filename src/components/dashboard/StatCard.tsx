import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

interface Props {
  title: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
  color?: string;
}

export default function StatCard({ title, value, helper, icon, color = "#146C94" }: Props) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography color="text.secondary" fontWeight={650} fontSize={13}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.7, mb: 0.4 }}>
              {value.toLocaleString()}
            </Typography>
            <Typography color="text.secondary" fontSize={12}>
              {helper}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(color, 0.11),
              color,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
