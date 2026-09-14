import { sosUrgencyLabel } from "../../services/sosUrgency";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import maplibregl from "maplibre-gl";

import type {
  Feature,
  FeatureCollection,
  LineString,
} from "geojson";

import {
  listenActiveEmergencies,
} from "../../services/mapService";

import type {
  Emergency,
  EmergencyLocationPoint,
  EmergencyResponderResponse,
} from "../../types";

import {
  mobileProfileImageSource,
} from "../../utils/imageData";

const DEFAULT_CENTER: [number, number] = [
  120.9842,
  14.5995,
];

const STALE_AFTER_MS =
  2 * 60 * 1000;

const LINE_SOURCE_ID =
  "healthmate-response-lines";

const LINE_LAYER_ID =
  "healthmate-response-lines-layer";

const ARROW_LAYER_ID =
  "healthmate-response-lines-arrows";

interface EmergencyMapProps {
  focusIncidentId?: string;
}

interface ResponseLineProperties {
  incidentId: string;
  coordinator: boolean;
}

type ResponseLineFeature = Feature<
  LineString,
  ResponseLineProperties
>;

function validLocation(
  location:
    | EmergencyLocationPoint
    | undefined,
): location is EmergencyLocationPoint {
  return Boolean(
    location &&
      Number.isFinite(
        location.latitude,
      ) &&
      Number.isFinite(
        location.longitude,
      ) &&
      !(
        location.latitude === 0 &&
        location.longitude === 0
      ),
  );
}

function isStale(
  updatedAt: number,
): boolean {
  return (
    !updatedAt ||
    Date.now() - updatedAt >
      STALE_AFTER_MS
  );
}

function initials(
  name?: string,
): string {
  const parts = (
    name?.trim() || "SOS"
  )
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length > 1) {
    return (
      `${parts[0][0]}${parts[1][0]}`
    ).toUpperCase();
  }

  return parts[0]
    .slice(0, 2)
    .toUpperCase();
}

function safeText(
  value: unknown,
  fallback = "",
): string {
  const normalized =
    String(value ?? "").trim();

  return normalized || fallback;
}

function formatUpdatedAt(
  updatedAt: number,
): string {
  if (
    !updatedAt ||
    !Number.isFinite(updatedAt)
  ) {
    return "Unknown";
  }

  return new Date(
    updatedAt,
  ).toLocaleString();
}

function formatCoordinates(
  location:
    EmergencyLocationPoint,
): string {
  return (
    `${location.latitude.toFixed(6)}, ` +
    `${location.longitude.toFixed(6)}`
  );
}

function patientLocationLabel(
  emergency: Emergency,
): string {
  const barangayName =
    safeText(
      emergency.locationSummary
        ?.barangayName,
    );

  if (barangayName) {
    return barangayName;
  }

  const address =
    safeText(
      emergency.patientProfile
        ?.address,
    );

  if (address) {
    return address;
  }

  const assignedBarangay =
    safeText(
      emergency.assignedBarangayId,
    );

  if (
    assignedBarangay &&
    assignedBarangay.toUpperCase() !==
      "UNASSIGNED"
  ) {
    return assignedBarangay.replace(
      /_/g,
      " ",
    );
  }

  return "Location name unavailable";
}

function appendLine(
  root: HTMLElement,
  label: string,
  value: string,
  strong = false,
): void {
  const line =
    document.createElement("div");

  line.style.marginBottom =
    "7px";

  const labelElement =
    document.createElement("span");

  labelElement.textContent =
    `${label}: `;

  labelElement.style.color =
    "#667085";

  labelElement.style.fontSize =
    "12px";

  const valueElement =
    document.createElement(
      strong
        ? "strong"
        : "span",
    );

  valueElement.textContent =
    value;

  valueElement.style.fontSize =
    strong
      ? "14px"
      : "12px";

  valueElement.style.color =
    "#101828";

  line.append(
    labelElement,
    valueElement,
  );

  root.appendChild(line);
}

function appendPhoneLine(
  root: HTMLElement,
  phone: string,
): void {
  const line =
    document.createElement("div");

  line.style.marginBottom =
    "7px";

  const labelElement =
    document.createElement("span");

  labelElement.textContent =
    "Phone: ";

  labelElement.style.color =
    "#667085";

  labelElement.style.fontSize =
    "12px";

  if (!phone) {
    const value =
      document.createElement(
        "span",
      );

    value.textContent =
      "Not recorded";

    value.style.fontSize =
      "12px";

    value.style.color =
      "#101828";

    line.append(
      labelElement,
      value,
    );

    root.appendChild(line);

    return;
  }

  const link =
    document.createElement("a");

  link.href =
    `tel:${phone}`;

  link.textContent =
    phone;

  link.style.fontSize =
    "12px";

  link.style.fontWeight =
    "700";

  link.style.color =
    "#0B7F88";

  link.style.textDecoration =
    "none";

  line.append(
    labelElement,
    link,
  );

  root.appendChild(line);
}

function patientPopup(
  emergency: Emergency,
  onOpen: () => void,
): HTMLElement {
  const root =
    document.createElement(
      "div",
    );

  root.className =
    "hm-map-popup";

  const header =
    document.createElement(
      "div",
    );

  header.className =
    "hm-map-popup__header";

  const avatar =
    document.createElement(
      "div",
    );

  avatar.className =
    "hm-map-popup__avatar";

  const source =
    mobileProfileImageSource(
      emergency.patientProfile
        ?.profileImage,
    );

  if (source) {
    const image =
      document.createElement(
        "img",
      );

    image.src = source;

    image.alt =
      emergency.patientName ||
      "Emergency patient";

    image.onerror = () => {
      image.remove();

      avatar.textContent =
        initials(
          emergency.patientName,
        );
    };

    avatar.appendChild(image);
  } else {
    avatar.textContent =
      initials(
        emergency.patientName,
      );
  }

  const title =
    document.createElement(
      "div",
    );

  const name =
    document.createElement(
      "strong",
    );

  name.textContent =
    emergency.patientName ||
    "Unknown HealthMate user";

  const subtitle =
    document.createElement(
      "div",
    );

  subtitle.textContent =
    "Active SOS patient";

  subtitle.style.color =
    "#D92D20";

  subtitle.style.fontSize =
    "12px";

  subtitle.style.fontWeight =
    "700";

  title.append(
    name,
    subtitle,
  );

  header.append(
    avatar,
    title,
  );

  root.appendChild(
    header,
  );

  /*
   * The SOS user's number is shown here.
   * Clicking it opens the device/browser dial action.
   */
  appendPhoneLine(
    root,
    safeText(
      emergency.patientPhone,
    ),
  );

  appendLine(
    root,
    "SOS urgency",
    sosUrgencyLabel(emergency.priority),
    true,
  );

  appendLine(
    root,
    "Status",
    safeText(
      emergency.status,
      "ACTIVE",
    ).replace(
      /_/g,
      " ",
    ),
  );

  appendLine(
    root,
    "GPS",
    isStale(
      emergency.location.updatedAt,
    )
      ? "STALE"
      : "LIVE",
  );

  appendLine(
    root,
    "Location",
    patientLocationLabel(
      emergency,
    ),
  );

  appendLine(
    root,
    "Coordinates",
    formatCoordinates(
      emergency.location,
    ),
  );

  appendLine(
    root,
    "Updated",
    formatUpdatedAt(
      emergency.location.updatedAt,
    ),
  );

  const button =
    document.createElement(
      "button",
    );

  button.type =
    "button";

  button.className =
    "hm-map-popup__button";

  button.textContent =
    "Open incident details";

  button.addEventListener(
    "click",
    onOpen,
  );

  root.appendChild(
    button,
  );

  return root;
}

function responderPopup(
  emergency: Emergency,
  response:
    EmergencyResponderResponse,
): HTMLElement {
  const root =
    document.createElement(
      "div",
    );

  root.className =
    "hm-map-popup";

  const name =
    document.createElement(
      "strong",
    );

  name.textContent =
    response.responderName ||
    response.responderUid ||
    "Respondent";

  name.style.display =
    "block";

  name.style.marginBottom =
    "8px";

  root.appendChild(name);

  appendLine(
    root,
    "Patient",
    emergency.patientName ||
      emergency.id,
  );

  appendLine(
    root,
    "Team role",
    response.teamRole ||
      "SUPPORTING_RESPONDER",
  );

  appendLine(
    root,
    "Response",
    (
      response.responseStatus ||
      "ACCEPTED"
    ).replace(
      /_/g,
      " ",
    ),
  );

  if (
    response.location
  ) {
    appendLine(
      root,
      "Location",
      isStale(
        response.location
          .updatedAt,
      )
        ? "STALE"
        : "LIVE",
    );

    appendLine(
      root,
      "Coordinates",
      formatCoordinates(
        response.location,
      ),
    );
  }

  return root;
}

function createPatientMarkerElement(
  emergency: Emergency,
): HTMLButtonElement {
  const element =
    document.createElement(
      "button",
    );

  element.type =
    "button";

  element.className =
    "hm-sos-map-marker";

  element.setAttribute(
    "aria-label",
    `Open SOS marker for ${
      emergency.patientName ||
      "HealthMate user"
    }`,
  );

  const avatar =
    document.createElement(
      "span",
    );

  avatar.className =
    "hm-sos-map-marker__avatar";

  const source =
    mobileProfileImageSource(
      emergency.patientProfile
        ?.profileImage,
    );

  if (source) {
    const image =
      document.createElement(
        "img",
      );

    image.src = source;
    image.alt = "";

    image.onerror = () => {
      image.remove();

      avatar.textContent =
        initials(
          emergency.patientName,
        );
    };

    avatar.appendChild(
      image,
    );
  } else {
    avatar.textContent =
      initials(
        emergency.patientName,
      );
  }

  const badge =
    document.createElement(
      "span",
    );

  badge.className =
    "hm-sos-map-marker__badge";

  badge.textContent =
    "SOS";

  element.append(
    avatar,
    badge,
  );

  return element;
}

export default function EmergencyMap({
  focusIncidentId,
}: EmergencyMapProps) {
  const navigate =
    useNavigate();

  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const markersRef =
    useRef<
      maplibregl.Marker[]
    >([]);

  const latestEmergenciesRef =
    useRef<Emergency[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    activeIncidentCount,
    setActiveIncidentCount,
  ] = useState(0);

  const [
    unlocatedIncidentCount,
    setUnlocatedIncidentCount,
  ] = useState(0);

  const mapTilerKey =
    import.meta.env
      .VITE_MAPTILER_KEY
      ?.trim();

  const configuredStyleUrl =
    import.meta.env
      .VITE_MAP_STYLE_URL
      ?.trim();

  const styleUrl =
    useMemo(() => {
      if (
        configuredStyleUrl
      ) {
        return configuredStyleUrl;
      }

      if (mapTilerKey) {
        return (
          "https://api.maptiler.com/" +
          "maps/streets-v2/" +
          "style.json?key=" +
          encodeURIComponent(
            mapTilerKey,
          )
        );
      }

      return "";
    }, [
      configuredStyleUrl,
      mapTilerKey,
    ]);

  useEffect(() => {
    const container =
      containerRef.current;

    if (
      !container ||
      !styleUrl
    ) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const map =
      new maplibregl.Map({
        container,
        style: styleUrl,
        center:
          DEFAULT_CENTER,
        zoom: 10,
        attributionControl: {
          compact: true,
        },
      });

    map.addControl(
      new maplibregl.NavigationControl(
        {
          showCompass: true,
        },
      ),
      "top-right",
    );

    map.addControl(
      new maplibregl.FullscreenControl(),
      "top-right",
    );

    const clearMarkers =
      (): void => {
        markersRef.current.forEach(
          (marker) =>
            marker.remove(),
        );

        markersRef.current =
          [];
      };

    const render = (
      emergencies:
        Emergency[],
    ): void => {
      if (
        !map.isStyleLoaded()
      ) {
        return;
      }

      clearMarkers();

      const allBounds =
        new maplibregl.LngLatBounds();

      const focusBounds =
        new maplibregl.LngLatBounds();

      const lineFeatures:
        ResponseLineFeature[] =
        [];

      for (
        const emergency
        of emergencies
      ) {
        /*
         * An active SOS with no readable coordinate
         * remains in the active count/listener.
         *
         * We simply cannot draw its marker until a
         * valid location becomes available.
         */
        if (
          !validLocation(
            emergency.location,
          )
        ) {
          continue;
        }

        const patientCoordinates:
          [number, number] = [
            emergency.location
              .longitude,
            emergency.location
              .latitude,
          ];

        const patientMarker =
          new maplibregl.Marker(
            {
              element:
                createPatientMarkerElement(
                  emergency,
                ),
              anchor:
                "bottom",
            },
          )
            .setLngLat(
              patientCoordinates,
            )
            .setPopup(
              new maplibregl.Popup(
                {
                  offset: 34,
                  maxWidth:
                    "360px",
                },
              ).setDOMContent(
                patientPopup(
                  emergency,
                  () => {
                    navigate(
                      `/emergencies/${emergency.id}`,
                    );
                  },
                ),
              ),
            )
            .addTo(map);

        markersRef.current.push(
          patientMarker,
        );

        allBounds.extend(
          patientCoordinates,
        );

        if (
          focusIncidentId ===
          emergency.id
        ) {
          focusBounds.extend(
            patientCoordinates,
          );
        }

        const responses =
          Object.values(
            emergency.responders ??
              {},
          );

        for (
          const response
          of responses
        ) {
          if (
            !response.active ||
            !validLocation(
              response.location,
            )
          ) {
            continue;
          }

          const responderCoordinates:
            [number, number] = [
              response.location
                .longitude,
              response.location
                .latitude,
            ];

          const responderColor =
            response.teamRole ===
            "COORDINATOR"
              ? "#1570EF"
              : "#039855";

          const responderMarker =
            new maplibregl.Marker(
              {
                color:
                  responderColor,
              },
            )
              .setLngLat(
                responderCoordinates,
              )
              .setPopup(
                new maplibregl.Popup(
                  {
                    offset:
                      24,
                  },
                ).setDOMContent(
                  responderPopup(
                    emergency,
                    response,
                  ),
                ),
              )
              .addTo(map);

          markersRef.current.push(
            responderMarker,
          );

          allBounds.extend(
            responderCoordinates,
          );

          if (
            focusIncidentId ===
            emergency.id
          ) {
            focusBounds.extend(
              responderCoordinates,
            );
          }

          /*
           * Direction is RESPONDENT -> PATIENT.
           * Repeated arrows therefore point toward
           * the SOS patient.
           */
          lineFeatures.push({
            type:
              "Feature",

            properties: {
              incidentId:
                emergency.id,

              coordinator:
                response.teamRole ===
                "COORDINATOR",
            },

            geometry: {
              type:
                "LineString",

              coordinates: [
                responderCoordinates,
                patientCoordinates,
              ],
            },
          });
        }
      }

      const source =
        map.getSource(
          LINE_SOURCE_ID,
        ) as
          | maplibregl.GeoJSONSource
          | undefined;

      const lineData:
        FeatureCollection<
          LineString,
          ResponseLineProperties
        > = {
        type:
          "FeatureCollection",

        features:
          lineFeatures,
      };

      if (source) {
        source.setData(
          lineData,
        );
      }

      const targetBounds =
        !focusBounds.isEmpty()
          ? focusBounds
          : allBounds;

      if (
        !targetBounds.isEmpty()
      ) {
        map.fitBounds(
          targetBounds,
          {
            padding: 90,
            maxZoom: 15,
            duration: 850,
          },
        );
      }
    };

    const handleLoad =
      (): void => {
        if (
          !map.getSource(
            LINE_SOURCE_ID,
          )
        ) {
          const emptyLineData:
            FeatureCollection<
              LineString,
              ResponseLineProperties
            > = {
            type:
              "FeatureCollection",

            features: [],
          };

          map.addSource(
            LINE_SOURCE_ID,
            {
              type:
                "geojson",

              data:
                emptyLineData,
            },
          );
        }

        if (
          !map.getLayer(
            LINE_LAYER_ID,
          )
        ) {
          map.addLayer({
            id:
              LINE_LAYER_ID,

            type:
              "line",

            source:
              LINE_SOURCE_ID,

            paint: {
              "line-color":
                "#D92D20",

              "line-width":
                3,

              "line-opacity":
                0.68,

              "line-dasharray":
                [2, 2],
            },
          });
        }

        if (
          !map.getLayer(
            ARROW_LAYER_ID,
          )
        ) {
          map.addLayer({
            id:
              ARROW_LAYER_ID,

            type:
              "symbol",

            source:
              LINE_SOURCE_ID,

            layout: {
              "symbol-placement":
                "line",

              "symbol-spacing":
                85,

              "text-field":
                "➤",

              "text-size":
                18,

              "text-rotation-alignment":
                "map",

              "text-keep-upright":
                false,

              "text-allow-overlap":
                true,
            },

            paint: {
              "text-color":
                "#D92D20",

              "text-halo-color":
                "#FFFFFF",

              "text-halo-width":
                1.5,
            },
          });
        }

        setLoading(false);

        render(
          latestEmergenciesRef.current,
        );
      };

    /*
     * Keep this untyped at the MapLibre-specific
     * event-name level to remain compatible across
     * MapLibre GL JS versions.
     */
    map.on(
      "error",
      (event) => {
        const message =
          event.error
            ?.message
            ?.trim();

        setError(
          message ||
            "The map could not be loaded.",
        );

        setLoading(false);
      },
    );

    map.on(
      "load",
      handleLoad,
    );

    const unsubscribe =
      listenActiveEmergencies(
        (
          emergencies,
        ) => {
          latestEmergenciesRef.current =
            emergencies;

          setActiveIncidentCount(
            emergencies.length,
          );

          setUnlocatedIncidentCount(
            emergencies.filter(
              (item) =>
                !validLocation(
                  item.location,
                ),
            ).length,
          );

          render(
            emergencies,
          );
        },

        (failure) => {
          setError(
            `Live SOS data access failed at ${failure.path}: ${failure.error.message}`,
          );

          setLoading(false);
        },
      );

    return () => {
      if (
        typeof unsubscribe ===
        "function"
      ) {
        unsubscribe();
      }

      clearMarkers();

      map.remove();
    };
  }, [
    styleUrl,
    focusIncidentId,
    navigate,
  ]);

  if (!styleUrl) {
    return (
      <Alert severity="warning">
        Add{" "}
        <strong>
          VITE_MAP_STYLE_URL
        </strong>{" "}
        or{" "}
        <strong>
          VITE_MAPTILER_KEY
        </strong>{" "}
        to the administrator{" "}
        <code>.env</code> file
        to enable the live map.
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        position:
          "relative",

        minHeight: {
          xs: 480,
          md: 670,
        },
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width:
            "100%",

          height: {
            xs: 480,
            md: 670,
          },

          borderRadius:
            3.5,

          overflow:
            "hidden",

          border:
            "1px solid",

          borderColor:
            "divider",
        }}
      />

      <Paper
        sx={{
          position:
            "absolute",

          top: 16,
          left: 16,

          p: 1.25,

          borderRadius:
            2.5,

          bgcolor:
            "rgba(255,255,255,0.94)",

          backdropFilter:
            "blur(8px)",

          zIndex: 4,
        }}
      >
        <Stack spacing={0.7}>
          <Typography
            fontSize={11}
            fontWeight={900}
            color="text.secondary"
            textTransform="uppercase"
            letterSpacing={0.8}
          >
            Map legend
          </Typography>

          <Stack
            direction="row"
            spacing={0.8}
            alignItems="center"
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius:
                  "50%",
                bgcolor:
                  "error.main",
              }}
            />

            <Typography
              fontSize={12}
            >
              SOS patient
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={0.8}
            alignItems="center"
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius:
                  "50%",
                bgcolor:
                  "#1570EF",
              }}
            />

            <Typography
              fontSize={12}
            >
              Coordinator
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={0.8}
            alignItems="center"
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius:
                  "50%",
                bgcolor:
                  "#039855",
              }}
            />

            <Typography
              fontSize={12}
            >
              Supporting
              respondent
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {loading && (
        <Box
          sx={{
            position:
              "absolute",

            inset: 0,

            display:
              "grid",

            placeItems:
              "center",

            bgcolor:
              "rgba(255,255,255,0.72)",

            borderRadius:
              3,

            zIndex:
              5,
          }}
        >
          <CircularProgress
            size={36}
          />
        </Box>
      )}

      {activeIncidentCount >
        0 &&
        unlocatedIncidentCount >
          0 && (
          <Alert
            severity="warning"
            sx={{
              position:
                "absolute",

              left: 16,
              right: 16,

              bottom:
                error
                  ? 84
                  : 16,

              zIndex:
                5,
            }}
          >
            {unlocatedIncidentCount ===
            activeIncidentCount
              ? "Active SOS incidents were found, but their coordinates are not readable. The incidents remain active; verify the emergencyLocations and liveLocations database rules."
              : `${unlocatedIncidentCount} active SOS incident${
                  unlocatedIncidentCount ===
                  1
                    ? ""
                    : "s"
                } currently has no readable coordinates.`}
          </Alert>
        )}

      {!loading &&
        activeIncidentCount ===
          0 && (
          <Paper
            sx={{
              position:
                "absolute",

              left:
                16,

              bottom:
                16,

              px:
                2,

              py:
                1.25,

              borderRadius:
                2.5,

              bgcolor:
                "rgba(255,255,255,0.94)",

              zIndex:
                4,
            }}
          >
            <Typography
              fontWeight={
                800
              }
              fontSize={
                13
              }
            >
              No active SOS
              incident is
              currently available.
            </Typography>
          </Paper>
        )}

      {error && (
        <Alert
          severity="error"
          sx={{
            position:
              "absolute",

            left:
              16,

            right:
              16,

            bottom:
              16,

            zIndex:
              6,
          }}
        >
          {error}
        </Alert>
      )}
    </Box>
  );
}
