import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  saveDirectoryContact,
  type DirectoryScope,
} from "../services/directoryService";
import type {
  EmergencyContactCategory,
  EmergencyDirectoryContact,
} from "../types";

const CATEGORIES: EmergencyContactCategory[] = [
  "BARANGAY_HALL",
  "BARANGAY_CAPTAIN",
  "BARANGAY_TANOD",
  "HEALTH_CENTER",
  "AMBULANCE",
  "RESCUE_TEAM",
  "POLICE",
  "FIRE",
  "DISASTER_OFFICE",
  "HOSPITAL",
  "RED_CROSS",
  "WATER",
  "ELECTRICITY",
  "SOCIAL_WELFARE",
  "OTHER",
];

type ContactFormState = Omit<
  EmergencyDirectoryContact,
  "id" | "createdAt" | "updatedAt"
>;

const EMPTY_CONTACT: ContactFormState = {
  shortName: "",
  organizationName: "",
  category: "OTHER",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
  active: true,
  displayOrder: 100,
};

export interface ContactFormDialogProps {
  open: boolean;
  scope: DirectoryScope;
  barangayId?: string;
  contact: EmergencyDirectoryContact | null;
  onClose: () => void;
}

function contactToForm(
  contact: EmergencyDirectoryContact | null,
): ContactFormState {
  if (!contact) {
    return { ...EMPTY_CONTACT };
  }

  return {
    shortName: contact.shortName ?? "",
    organizationName: contact.organizationName ?? "",
    category: contact.category ?? "OTHER",
    phone: contact.phone ?? "",
    alternatePhone: contact.alternatePhone ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    active: contact.active !== false,
    displayOrder: contact.displayOrder ?? 100,
  };
}

export default function ContactFormDialog({
  open,
  scope,
  barangayId,
  contact,
  onClose,
}: ContactFormDialogProps) {
  const [form, setForm] = useState<ContactFormState>({
    ...EMPTY_CONTACT,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(contactToForm(contact));
    setError("");
  }, [contact, open]);

  const normalizedBarangayId = barangayId?.trim() || undefined;

  async function save(): Promise<void> {
    if (scope === "barangay" && !normalizedBarangayId) {
      setError("Select a barangay before saving this emergency line.");
      return;
    }

    const shortName = form.shortName.trim();
    const organizationName = form.organizationName.trim();
    const phone = form.phone.trim();

    if (!shortName) {
      setError("Short name is required.");
      return;
    }

    if (!organizationName) {
      setError("Organization name is required.");
      return;
    }

    if (!phone) {
      setError("Primary phone number is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await saveDirectoryContact(
        scope,
        {
          id: contact?.id,
          shortName,
          organizationName,
          category: form.category,
          phone,
          alternatePhone: form.alternatePhone?.trim() || "",
          email: form.email?.trim() || "",
          address: form.address?.trim() || "",
          active: form.active,
          displayOrder: Number.isFinite(Number(form.displayOrder))
            ? Number(form.displayOrder)
            : 100,
          createdAt: contact?.createdAt,
          updatedAt: contact?.updatedAt,
        },
        normalizedBarangayId,
      );

      onClose();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the emergency contact.",
      );
    } finally {
      setSaving(false);
    }
  }

  function closeDialog(): void {
    if (saving) {
      return;
    }

    setError("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : closeDialog}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {contact
          ? "Edit emergency line"
          : scope === "global"
            ? "Add general emergency hotline"
            : "Add Bunuanan emergency contact"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={0.5}>
            <Typography fontWeight={900}>Agency identity</Typography>
            <Typography color="text.secondary" fontSize={12.5}>
              Use the official service or agency name shown to Respondents.
            </Typography>
          </Stack>

          <TextField
            autoFocus
            fullWidth
            required
            label="Short name"
            value={form.shortName}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                shortName: event.target.value,
              }))
            }
            helperText="Example: City Rescue, PNP, Fire Station, Barangay Health Center"
          />

          <TextField
            fullWidth
            required
            label="Organization name"
            value={form.organizationName}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                organizationName: event.target.value,
              }))
            }
          />

          <TextField
            select
            fullWidth
            label="Category"
            value={form.category}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value as EmergencyContactCategory,
              }))
            }
          >
            {CATEGORIES.map((category) => (
              <MenuItem key={category} value={category}>
                {category.replace(/_/g, " ")}
              </MenuItem>
            ))}
          </TextField>

          <Divider />

          <Stack spacing={0.5}>
            <Typography fontWeight={900}>Contact channels</Typography>
            <Typography color="text.secondary" fontSize={12.5}>
              The primary phone number is the number opened by the Respondent app.
            </Typography>
          </Stack>

          <TextField
            fullWidth
            required
            type="tel"
            label="Primary phone number"
            value={form.phone}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            helperText="The Android user/respondent app opens this number in the phone dialer."
          />

          <TextField
            fullWidth
            type="tel"
            label="Alternate phone number"
            value={form.alternatePhone ?? ""}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                alternatePhone: event.target.value,
              }))
            }
          />

          <TextField
            fullWidth
            type="email"
            label="Email address"
            value={form.email ?? ""}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Address"
            value={form.address ?? ""}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
          />

          <Divider />

          <Stack spacing={0.5}>
            <Typography fontWeight={900}>Directory behavior</Typography>
            <Typography color="text.secondary" fontSize={12.5}>
              Lower display-order values appear first. Disabled contacts stay in Admin but are hidden from Respondents.
            </Typography>
          </Stack>

          <TextField
            fullWidth
            type="number"
            label="Display order"
            value={form.displayOrder ?? 100}
            disabled={saving}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                displayOrder: Number(event.target.value),
              }))
            }
            inputProps={{ min: 0, step: 1 }}
            helperText="Lower numbers appear first in the emergency directory."
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={closeDialog} disabled={saving}>
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={save}
          disabled={
            saving ||
            !form.shortName.trim() ||
            !form.organizationName.trim() ||
            !form.phone.trim() ||
            (scope === "barangay" && !normalizedBarangayId)
          }
        >
          {saving ? (
            <CircularProgress size={20} color="inherit" />
          ) : contact ? (
            "Update line"
          ) : (
            "Save line"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}