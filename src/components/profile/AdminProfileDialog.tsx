import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { updateAdminProfile } from "../../services/adminProfileService";

function buildInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "A";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function AdminProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, role, adminProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [officeTitle, setOfficeTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return;

    setFullName(adminProfile?.fullName ?? user?.displayName ?? "");
    setPhone(adminProfile?.phone ?? "");
    setOfficeTitle(adminProfile?.officeTitle ?? "");
    setDepartment(adminProfile?.department ?? "");
    setSuccessMessage("");
    setErrorMessage("");
  }, [open, adminProfile, user]);

  const displayEmail = adminProfile?.email ?? user?.email ?? "";
  const displayName = fullName || adminProfile?.fullName || user?.displayName || "Administrator";
  const initials = useMemo(() => buildInitials(displayName, displayEmail), [displayName, displayEmail]);

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      await updateAdminProfile(user.uid, {
        fullName,
        phone,
        officeTitle,
        department,
      });
      setSuccessMessage("Administrator profile updated successfully.");
    } catch (error) {
      console.error("Failed to update administrator profile", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the administrator profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1.5 }}>Administrator profile</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: 22, fontWeight: 700 }}>
              {initials}
            </Avatar>

            <Box>
              <Typography variant="h6" fontWeight={800}>
                {displayName}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                {displayEmail}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={role ?? "No role"}
                  sx={{ textTransform: "capitalize" }}
                />
                <Chip
                  size="small"
                  color="success"
                  label={String(adminProfile?.accountStatus ?? "active")}
                  sx={{ textTransform: "capitalize" }}
                />
              </Stack>
            </Box>
          </Stack>

          <Divider />

          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <TextField
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Email"
            value={displayEmail}
            fullWidth
            InputProps={{ readOnly: true }}
            helperText="Email is controlled by the authenticated administrator account."
          />

          <TextField
            label="Phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            fullWidth
          />

          <TextField
            label="Office title"
            value={officeTitle}
            onChange={(event) => setOfficeTitle(event.target.value)}
            fullWidth
            placeholder="e.g. System Administrator"
          />

          <TextField
            label="Department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            fullWidth
            placeholder="e.g. City Health and Emergency Administration"
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}