import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("HealthMate Admin encountered an unrecoverable UI error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3, bgcolor: "background.default" }}>
        <Card sx={{ width: "100%", maxWidth: 620 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={2.5}>
              <Typography variant="h4">HealthMate could not start</Typography>
              <Alert severity="error">
                {this.state.error.message || "An unexpected application error occurred."}
              </Alert>
              <Typography color="text.secondary">
                Check the Firebase web configuration, network connection, and browser console. No emergency data was changed by this error screen.
              </Typography>
              <Button variant="contained" onClick={() => window.location.reload()}>
                Reload application
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }
}
