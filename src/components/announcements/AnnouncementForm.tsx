import {
  CloudUploadOutlined,
  DeleteOutline,
  ImageOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type ChangeEvent } from "react";
import { createAnnouncement } from "../../services/announcementService";
import type { AnnouncementCategory } from "../../types";
import {
  announcementImageSource,
  compressAnnouncementImage,
  type CompressedImageData,
} from "../../utils/imageData";

const categories: AnnouncementCategory[] = [
  "Barangay News",
  "Health Advisory",
  "Disease Outbreak Alert",
  "Disaster Warning",
  "Weather Advisory",
  "Vaccination Campaign",
  "Community Event",
];

export default function AnnouncementForm({ close }: { close: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("Health Advisory");
  const [expiresAtText, setExpiresAtText] = useState("");
  const [image, setImage] = useState<CompressedImageData | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setProcessingImage(true);
    try {
      setImage(await compressAnnouncementImage(file));
    } catch (reason) {
      setImage(null);
      setError(reason instanceof Error ? reason.message : "The image could not be processed.");
    } finally {
      setProcessingImage(false);
    }
  }

  async function save() {
    setError("");
    const expiresAt = expiresAtText ? new Date(expiresAtText).getTime() : 0;

    if (expiresAtText && !Number.isFinite(expiresAt)) {
      setError("Enter a valid announcement expiry date and time.");
      return;
    }

    setSaving(true);
    try {
      await createAnnouncement({
        title,
        content,
        category,
        expiresAt,
        imageData: image?.imageData,
        imageMimeType: image?.imageMimeType,
      });
      close();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The announcement could not be published.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle>Publish a mobile announcement</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info">
            The optional picture is resized and compressed before it is stored in Firebase Realtime Database. Firebase Storage is not used.
          </Alert>

          <TextField
            label="Title"
            value={title}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
            inputProps={{ maxLength: 120 }}
            helperText={`${title.length}/120`}
            required
          />

          <TextField
            label="Safety information or announcement"
            multiline
            minRows={6}
            value={content}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setContent(event.target.value)}
            inputProps={{ maxLength: 5000 }}
            helperText={`${content.length}/5000 — Include clear, practical steps residents can follow.`}
            required
          />

          <TextField
            select
            label="Category"
            value={category}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setCategory(event.target.value as AnnouncementCategory)
            }
          >
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </TextField>

          <Box
            sx={{
              border: "1px dashed",
              borderColor: image ? "primary.main" : "divider",
              borderRadius: 3,
              p: 2,
              bgcolor: image ? "primary.50" : "background.default",
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={processingImage ? <CircularProgress size={18} /> : <CloudUploadOutlined />}
                  disabled={processingImage || saving}
                >
                  {image ? "Replace picture" : "Add announcement picture"}
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
                </Button>
                {image && (
                  <Button
                    color="error"
                    startIcon={<DeleteOutline />}
                    onClick={() => setImage(null)}
                    disabled={saving}
                  >
                    Remove
                  </Button>
                )}
              </Stack>

              {image ? (
                <Box>
                  <Box
                    component="img"
                    src={announcementImageSource(image.imageData, image.imageMimeType)}
                    alt="Announcement preview"
                    sx={{
                      display: "block",
                      width: "100%",
                      maxHeight: 280,
                      objectFit: "cover",
                      borderRadius: 2.5,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {image.width} × {image.height}px · approximately {Math.max(1, Math.round(image.byteSize / 1024))} KB
                  </Typography>
                </Box>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                  <ImageOutlined fontSize="small" />
                  <Typography variant="caption">Optional JPG, PNG, or WebP. Maximum original file size: 8 MB.</Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <TextField
            label="Expiry date and time (optional)"
            type="datetime-local"
            value={expiresAtText}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setExpiresAtText(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Typography variant="caption" color="text.secondary">
            Examples: dengue prevention, safe drinking water, vaccination schedules, storm precautions, sanitation, and barangay notices.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={close} disabled={saving || processingImage}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || processingImage}>
          {saving ? "Publishing…" : "Publish to mobile users"}
        </Button>
      </DialogActions>
    </>
  );
}
