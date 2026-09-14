import { LockOutlined, MedicalServicesOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loginUser } from "../firebase/auth";

function friendlyAuthMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message = error instanceof Error ? error.message : "Unable to sign in.";
  const reason = `${code} ${message}`;
  if (
    reason.includes("auth/invalid-credential") ||
    reason.includes("auth/invalid-login-credentials") ||
    reason.includes("auth/user-not-found") ||
    reason.includes("auth/wrong-password")
  ) {
    return "The email or password is incorrect.";
  }
  if (reason.includes("auth/user-disabled")) return "This Firebase Authentication account is disabled.";
  if (reason.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  if (reason.includes("auth/invalid-email")) return "Enter a valid email address.";
  if (reason.includes("auth/network-request-failed")) return "Unable to reach. Check your connection and try again.";
  return message;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, role, loading, error: accessError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && role) {
      const requestedPath = (location.state as { from?: string } | null)?.from;
      const allowedDestinations = new Set([
        "/dashboard",
        "/emergencies",
        "/map",
        "/residents",
        "/announcements",
        "/reports",
        "/responders",
        "/directory",
        "/rescue-reports",
        "/audit",
      ]);
      navigate(requestedPath && allowedDestinations.has(requestedPath) ? requestedPath : "/dashboard", {
        replace: true,
      });
    }
  }, [loading, location.state, navigate, role, user]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await loginUser(email.trim(), password);
    } catch (authError) {
      setError(friendlyAuthMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "minmax(420px, 0.9fr) minmax(520px, 1.1fr)" },
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          position: "relative",
          overflow: "hidden",
          p: 7,
          color: "white",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #071C2C 0%, #0B3C5D 54%, #146C94 100%)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <MedicalServicesOutlined sx={{ fontSize: 34 }} />
          <Typography variant="h5">HealthMate</Typography>
        </Stack>
        <Box sx={{ maxWidth: 560 }}>
          <Typography variant="h3" fontWeight={850} lineHeight={1.08} sx={{ mb: 2 }}>
            Emergency coordination in one secure workspace.
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.72)", fontSize: 17, lineHeight: 1.7 }}>
            Monitor mobile SOS alerts, locate residents, assign responders, and document response actions in real time.
          </Typography>
        </Box>
        <Typography sx={{ color: "rgba(255,255,255,0.54)", fontSize: 13 }}>
          Authorized administrators only
        </Typography>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", p: { xs: 2, sm: 4 } }}>
        <Card sx={{ width: "100%", maxWidth: 470, borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box sx={{ display: { lg: "none" }, mb: 3 }}>
              <Typography variant="h5" color="primary.dark">
                HealthMate Admin
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Welcome back
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3.5 }}>
              Sign in with your authorized administrator account. Responders use the HealthMate Android app.
            </Typography>

            <Stack spacing={2} component="form" onSubmit={handleLogin}>
              {(error || accessError) && <Alert severity="error">{error || accessError}</Alert>}
              <TextField
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button fullWidth type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
