import {
  CameraAltRounded,
  DeleteOutlineRounded,
  SaveRounded,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import { useAuth } from "../context/AuthContext";
import { updateAdminProfile } from "../services/adminProfileService";
import { compressProfileImage, profileImageSource } from "../utils/imageData";

function initials(name: string, email: string) {
  const value = name.trim() || email.trim() || "A";
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

export default function AdminProfile() {
  const { user, role, adminProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [officeTitle, setOfficeTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [profileImageData, setProfileImageData] = useState<string | null>(null);
  const [profileImageMimeType, setProfileImageMimeType] = useState<"image/jpeg" | null>(null);
  const [profileImageByteSize, setProfileImageByteSize] = useState<number | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFullName(adminProfile?.fullName ?? user?.displayName ?? "");
    setPhone(adminProfile?.phone ?? "");
    setOfficeTitle(adminProfile?.officeTitle ?? "");
    setDepartment(adminProfile?.department ?? "");
    setProfileImageData(adminProfile?.profileImageData || null);
    setProfileImageMimeType(
      adminProfile?.profileImageData ? (adminProfile.profileImageMimeType as "image/jpeg") || "image/jpeg" : null,
    );
    setProfileImageByteSize(adminProfile?.profileImageByteSize ?? null);
  }, [adminProfile, user]);

  const email = adminProfile?.email || user?.email || "";
  const displayName = fullName.trim() || "HealthMate Administrator";
  const avatarSource = profileImageSource(profileImageData || undefined, profileImageMimeType || undefined);
  const avatarText = useMemo(() => initials(displayName, email), [displayName, email]);
  const roleLabel = role === "administrator" ? "Administrator" : "Admin";

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessingImage(true);
    setError("");
    setSuccess("");
    try {
      const compressed = await compressProfileImage(file);
      setProfileImageData(compressed.imageData);
      setProfileImageMimeType(compressed.imageMimeType);
      setProfileImageByteSize(compressed.byteSize);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Unable to process the selected image.");
    } finally {
      setProcessingImage(false);
    }
  }

  function removePhoto() {
    setProfileImageData(null);
    setProfileImageMimeType(null);
    setProfileImageByteSize(null);
    setSuccess("");
    setError("");
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await updateAdminProfile(user.uid, {
        fullName,
        phone,
        officeTitle,
        department,
        profileImageData,
        profileImageMimeType,
        profileImageByteSize,
      });
      setSuccess("Administrator profile updated. The header and sidebar have been refreshed.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the administrator profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Administrator profile"
        description="Manage the identity shown throughout the HealthMate administrator portal."
      />

      <Card sx={{ maxWidth: 960 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5, md: 4 } }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Box sx={{ position: "relative" }}>
                <Avatar
                  src={avatarSource || undefined}
                  alt={displayName}
                  sx={{
                    width: { xs: 92, sm: 112 },
                    height: { xs: 92, sm: 112 },
                    bgcolor: "primary.main",
                    fontWeight: 850,
                    fontSize: 28,
                    border: "5px solid #FFFFFF",
                    boxShadow: `0 0 0 1px ${alpha("#071D3C", 0.1)}, 0 14px 34px ${alpha("#071D3C", 0.14)}`,
                  }}
                >
                  {avatarText}
                </Avatar>
                {processingImage ? (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      bgcolor: alpha("#071D3C", 0.55),
                    }}
                  >
                    <CircularProgress size={28} sx={{ color: "white" }} />
                  </Box>
                ) : null}
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="h5" noWrap>
                  {displayName}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.35 }} noWrap>
                  {email}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.4 }}>
                  <Chip label={roleLabel} size="small" color="primary" variant="outlined" />
                  <Chip
                    label={adminProfile?.accountStatus || "active"}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 2 }}>
                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<CameraAltRounded />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processingImage || saving}
                  >
                    {profileImageData ? "Change photo" : "Upload photo"}
                  </Button>
                  {profileImageData ? (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRounded />}
                      onClick={removePhoto}
                      disabled={processingImage || saving}
                    >
                      Remove photo
                    </Button>
                  ) : null}
                </Stack>
                <Typography color="text.secondary" fontSize={12} sx={{ mt: 1.2 }}>
                  JPG, PNG, or WebP. The browser crops and compresses the image before saving it.
                </Typography>
              </Box>
            </Stack>

            <Divider />

            {success ? <Alert severity="success">{success}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 2.2,
              }}
            >
              <TextField
                label="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                fullWidth
                inputProps={{ maxLength: 120 }}
              />
              <TextField
                label="Email address"
                value={email}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="The authenticated email cannot be changed from this form."
              />
              <TextField
                label="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                fullWidth
                inputProps={{ maxLength: 40 }}
              />
              <TextField label="Portal role" value={roleLabel} fullWidth InputProps={{ readOnly: true }} />
              <TextField
                label="Office title"
                value={officeTitle}
                onChange={(event) => setOfficeTitle(event.target.value)}
                placeholder="Example: Emergency Operations Administrator"
                fullWidth
                inputProps={{ maxLength: 100 }}
              />
              <TextField
                label="Department or office"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Example: City Health and Emergency Office"
                fullWidth
                inputProps={{ maxLength: 120 }}
              />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />}
                onClick={saveProfile}
                disabled={saving || processingImage || !fullName.trim()}
              >
                {saving ? "Saving profile" : "Save profile"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
