import React from "react";
import ReactDOM from "react-dom/client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CssBaseline,
  Stack,
  ThemeProvider,
  Typography,
} from "@mui/material";

import "maplibre-gl/dist/maplibre-gl.css";
import "./styles/global.css";

import AppErrorBoundary from "./components/common/AppErrorBoundary";
import theme from "./theme";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "HealthMate Admin could not find the #root element.",
  );
}

const root =
  ReactDOM.createRoot(rootElement);

function renderStartupError(
  error: unknown,
): void {
  const message =
    error instanceof Error
      ? error.message
      : "An unknown startup error occurred.";

  console.error(
    "HealthMate Admin failed during application startup",
    error,
  );

  root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <Box
          sx={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            p: 3,
            bgcolor: "background.default",
          }}
        >
          <Card
            sx={{
              width: "100%",
              maxWidth: 680,
            }}
          >
            <CardContent
              sx={{
                p: {
                  xs: 3,
                  sm: 5,
                },
              }}
            >
              <Stack spacing={2.5}>
                <Typography variant="h4">
                  HealthMate could not start
                </Typography>

                <Alert severity="error">
                  {message}
                </Alert>

                <Typography color="text.secondary">
                  Check the Firebase environment
                  configuration and the first error
                  in the browser console.
                </Typography>

                <Button
                  variant="contained"
                  onClick={() =>
                    window.location.reload()
                  }
                >
                  Reload application
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </ThemeProvider>
    </React.StrictMode>,
  );
}

async function bootstrap(): Promise<void> {
  try {
    /*
     * Dynamic import allows startup module errors
     * to be caught and displayed.
     */
    const { default: App } =
      await import("./App");

    root.render(
      <React.StrictMode>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </ThemeProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    renderStartupError(error);
  }
}

void bootstrap();