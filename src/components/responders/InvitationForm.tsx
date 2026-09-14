import {
  Alert,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { listenBarangays } from "../../services/directoryService";
import { createRespondentInvitation } from "../../services/respondentInvitationService";
import type { Barangay } from "../../types";

export default function InvitationForm({ close }: { close: () => void }) {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("Emergency Respondent");
  const [assignedBarangayId, setAssignedBarangayId] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => listenBarangays((items) => setBarangays(items.filter((item) => item.active))), []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await createRespondentInvitation({ email, fullName, phone, position, assignedBarangayId, serviceArea });
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>Pre-authorize respondent</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="info">
            No password is created here. The invited person registers in the Android app using this exact email address.
          </Alert>
          <TextField label="Exact respondent email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} helperText="Must end with @respondent.com" />
          <TextField label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <TextField label="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <TextField label="Position" value={position} onChange={(event) => setPosition(event.target.value)} />
          <TextField select label="Assigned barangay" value={assignedBarangayId} onChange={(event) => setAssignedBarangayId(event.target.value)}>
            {barangays.map((barangay) => <MenuItem key={barangay.id} value={barangay.id}>{barangay.name}</MenuItem>)}
          </TextField>
          <TextField label="Service area (optional)" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !email || !fullName || !phone || !assignedBarangayId}>
          {saving ? <CircularProgress size={20} color="inherit" /> : "Create invitation"}
        </Button>
      </DialogActions>
    </>
  );
}
