import { SendOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { sendNotification } from "../../services/notificationService";

export default function NotificationForm({
  userId: fixedUserId,
  residentName,
}: {
  userId?: string;
  residentName?: string;
}) {
  const [userId, setUserId] = useState(fixedUserId ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => setUserId(fixedUserId ?? ""), [fixedUserId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await sendNotification(userId, title, message);
      setTitle("");
      setMessage("");
      setSuccess(`Notification queued${residentName ? ` for ${residentName}` : ""}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The notification could not be queued.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Notify resident</Typography>
          <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.4 }}>
            Creates an in-app notification and an FCM push through the trusted relay service.
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}
        {!fixedUserId && (
          <TextField
            fullWidth
            required
            label="Resident user ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
        )}
        <TextField
          fullWidth
          required
          label="Title"
          value={title}
          inputProps={{ maxLength: 120 }}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          fullWidth
          required
          multiline
          minRows={3}
          label="Message"
          value={message}
          inputProps={{ maxLength: 2000 }}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendOutlined />}
          disabled={submitting}
          sx={{ alignSelf: "flex-start" }}
        >
          {submitting ? "Queueing…" : "Send notification"}
        </Button>
      </Stack>
    </Box>
  );
}
