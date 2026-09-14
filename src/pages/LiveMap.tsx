import {
  MapRounded,
  WarningAmberRounded,
} from "@mui/icons-material";

import {
  Card,
  CardContent,
  Chip,
  Stack,
} from "@mui/material";

import {
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import PageHeader from "../components/common/PageHeader";
import EmergencyMap from "../components/map/EmergencyMap";
import { listenActiveEmergencies } from "../services/mapService";

export default function LiveMap() {
  const [activeCount, setActiveCount] =
    useState<number>(0);

  const [searchParams] = useSearchParams();

  const focusIncidentId =
    searchParams.get("incidentId") ?? undefined;

  useEffect(() => {
    const stopListening =
      listenActiveEmergencies((items) => {
        setActiveCount(items.length);
      });

    /*
     * Firebase listeners normally return an unsubscribe function.
     * This check also keeps the component compatible if the current
     * service temporarily returns void.
     */
    return typeof stopListening === "function"
      ? stopListening
      : undefined;
  }, []);

  return (
    <Stack spacing={2.75}>
      <PageHeader
        eyebrow="Live operations"
        title="Emergency response map"
        description={
          "See each active SOS patient and the real-time positions " +
          "of respondents who accepted the incident. Red dashed " +
          "lines show the active response connection."
        }
        action={
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
          >
            <Chip
              icon={<WarningAmberRounded />}
              label={`${activeCount} active SOS`}
              color={
                activeCount > 0
                  ? "error"
                  : "success"
              }
            />

            <Chip
              icon={<MapRounded />}
              label={
                focusIncidentId
                  ? "Incident focused"
                  : "All incidents"
              }
              variant="outlined"
            />
          </Stack>
        }
      />

      <Card>
        <CardContent
          sx={{
            p: {
              xs: 1,
              sm: 1.5,
            },
            "&:last-child": {
              pb: {
                xs: 1,
                sm: 1.5,
              },
            },
          }}
        >
          <EmergencyMap
            focusIncidentId={focusIncidentId}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}