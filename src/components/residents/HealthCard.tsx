import { HealthAndSafetyOutlined } from "@mui/icons-material";
import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import type { HealthProfile } from "../../types";

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <Box>
      <Typography color="text.secondary" fontSize={12} fontWeight={750}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.4 }}>{value?.trim() || "Not provided"}</Typography>
    </Box>
  );
}

export default function HealthCard({ health }: { health: HealthProfile | null }) {
  if (!health) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <HealthAndSafetyOutlined color="disabled" />
            <Box>
              <Typography fontWeight={800}>No medical profile available</Typography>
              <Typography color="text.secondary" fontSize={13}>
                The resident has not submitted medical information from the mobile app.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
          <HealthAndSafetyOutlined color="primary" />
          <Typography variant="h6">Medical information</Typography>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2.5 }}>
          <Detail label="Blood type" value={health.bloodType} />
          <Detail label="Allergies" value={health.allergies} />
          <Detail label="Medical conditions" value={health.conditions} />
          <Detail label="Current medications" value={health.medications} />
          <Detail label="Doctor or clinic" value={health.doctorName} />
          <Detail label="Doctor phone" value={health.doctorPhone} />
        </Box>
        <Divider sx={{ my: 2.5 }} />
        <Detail label="Emergency notes" value={health.emergencyNote || health.medicalHistory} />
      </CardContent>
    </Card>
  );
}
