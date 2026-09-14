import { ArrowBackOutlined, EmailOutlined, HomeOutlined, PhoneOutlined } from "@mui/icons-material";
import { Avatar, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import NotificationForm from "../components/notifications/NotificationForm";
import HealthCard from "../components/residents/HealthCard";
import { getHealthProfile } from "../services/healthService";
import type { HealthProfile, User } from "../types";
import { mobileProfileImageSource } from "../utils/imageData";

function ContactLine({ icon, value }: { icon: React.ReactNode; value?: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{ color: "text.secondary", display: "grid", placeItems: "center" }}>{icon}</Box>
      <Typography>{value || "Not provided"}</Typography>
    </Stack>
  );
}

export default function ResidentProfile({ user, back }: { user: User; back: () => void }) {
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getHealthProfile(user.uid)
      .then((profile) => {
        if (active) setHealth(profile);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.uid]);

  return (
    <Stack spacing={3}>
      <Box>
        <Button startIcon={<ArrowBackOutlined />} onClick={back}>
          Back to residents
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "center" }}>
            <Avatar src={mobileProfileImageSource(user.profileImage) || undefined} sx={{ width: 96, height: 96, fontSize: 32, bgcolor: "primary.main", fontWeight: 900, border: "4px solid white", boxShadow: "0 0 0 2px rgba(11,127,136,.18)" }}>
              {(user.fullName?.[0] ?? "R").toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                <Typography variant="h4">{user.fullName}</Typography>
                <Chip
                  size="small"
                  label={user.status || "Active"}
                  color={user.status === "inactive" ? "default" : "success"}
                  variant="outlined"
                  sx={{ textTransform: "capitalize" }}
                />
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Resident ID: {user.uid}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 3 }}>
            <ContactLine icon={<EmailOutlined fontSize="small" />} value={user.email} />
            <ContactLine icon={<PhoneOutlined fontSize="small" />} value={user.contactNumber || user.phone} />
            <ContactLine icon={<HomeOutlined fontSize="small" />} value={user.address} />
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent><Typography color="text.secondary">Loading medical profile…</Typography></CardContent></Card>
      ) : (
        <HealthCard health={health} />
      )}

      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <NotificationForm userId={user.uid} residentName={user.fullName} />
        </CardContent>
      </Card>
    </Stack>
  );
}
