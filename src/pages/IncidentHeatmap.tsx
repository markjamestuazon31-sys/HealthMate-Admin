import { sosUrgencyLabel, sosUrgencyRank } from "../services/sosUrgency";
import { downloadCsv } from "../utils/inhabitantExport";
import {
  CalendarMonthRounded,
  CloseRounded,
  CrisisAlertRounded,
  LocalFireDepartmentRounded,
  MapRounded,
  MyLocationRounded,
  OpenInNewRounded,
  PlaceRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import { listenIncidentAnalytics } from "../services/incidentAnalyticsService";
import type { IncidentAnalyticsRecord } from "../types";
import { BUNUANAN_PUROKS, purokSortValue } from "../config/bunuananServiceArea";

const BUNUANAN_CENTER: [number, number] = [124.8895, 11.7537];
const SOURCE_ID = "bunuanan-incident-analytics";
const HOTSPOT_SOURCE_ID = "bunuanan-hotspot-clusters";
const HEAT_LAYER_ID = "bunuanan-incident-heat";
const HOTSPOT_CLUSTER_LAYER_ID = "bunuanan-hotspot-clusters-layer";
const HOTSPOT_COUNT_LAYER_ID = "bunuanan-hotspot-count-layer";
const HOTSPOT_POINT_LAYER_ID = "bunuanan-hotspot-points-layer";
const TERMINAL = new Set(["CLOSED", "CANCELLED", "REPORT_SUBMITTED", "ADMIN_REVIEWED", "RESOLVED"]);

type HotspotSelection = {
  title: string;
  coordinates: [number, number];
  incidents: IncidentAnalyticsRecord[];
  purokName?: string;
};

function dateValue(timestamp: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number) {
  if (!timestamp) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function isActive(status: string) {
  return !TERMINAL.has(String(status || "").toUpperCase());
}

function priorityColor(priority: string): "error" | "warning" | "info" | "default" {
  switch (String(priority || "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "error";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "info";
    default:
      return "default";
  }
}

function HeatStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card sx={{ flex: "1 1 200px" }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 43, height: 43, borderRadius: 2.5, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "rgba(217,45,32,.09)" }}>{icon}</Box>
          <Box minWidth={0}>
            <Typography variant="h5" noWrap>{value}</Typography>
            <Typography fontSize={14} color="text.secondary">{label}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function hotspotTitle(incidents: IncidentAnalyticsRecord[]) {
  const counts = new Map<string, number>();
  incidents.forEach((item) => counts.set(item.purokId, (counts.get(item.purokId) ?? 0) + 1));
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!ordered.length) return "Incident hotspot";
  if (ordered.length === 1) return ordered[0][0];
  return `${ordered[0][0]} + ${ordered.length - 1} nearby`;
}

export default function IncidentHeatmap() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<IncidentAnalyticsRecord[]>([]);
  const [purok, setPurok] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotSelection | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const filteredRef = useRef<IncidentAnalyticsRecord[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [dataError, setDataError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [mapMode, setMapMode] = useState("density");
  const dateError = Boolean(fromDate && toDate && fromDate > toDate);
  function resetFilters() { setPurok(""); setType(""); setPriority(""); setStatus(""); setFromDate(""); setToDate(""); }
  function exportRecords() {
    downloadCsv("Bunuanan_Incident_Heatmap.csv", [
      ["Bunuanan incident heatmap"], ["Scope", "Mapped incidents with valid GPS"],
      ["Purok", purok || "All"], ["Urgency", priority ? sosUrgencyLabel(priority) : "All"],
      ["State", status || "All"], ["Type", type || "All"], ["From", fromDate || "Beginning"], ["To", toDate || "Latest"], [],
      ["Incident ID", "Purok", "SOS urgency", "Status", "Type", "Created (Philippine time)", "Latitude", "Longitude"],
      ...filtered.map(item => [item.id, item.purokId, sosUrgencyLabel(item.priority), item.status, item.type, formatDateTime(item.createdAt), item.latitude, item.longitude]),
    ]);
  }

  useEffect(() => {
    setLoading(true); setDataError("");
    return listenIncidentAnalytics(items => { setRecords(items); setLoading(false); setDataError(""); },
      () => { setDataError("Incident data could not be loaded. Check your connection and admin access."); setLoading(false); });
  }, [retry]);

  const puroks = useMemo(() => {
    const values = [...BUNUANAN_PUROKS] as string[];
    if (records.some((item) => item.purokId === "Unassigned")) values.push("Unassigned");
    return values;
  }, [records]);
  const types = useMemo(() => Array.from(new Set(records.map((item) => item.type))).sort(), [records]);

  const filtered = useMemo(() => records.filter((item) => {
    const day = dateValue(item.createdAt);
    return !dateError && (!purok || item.purokId === purok)
      && (!type || item.type === type)
      && (!priority || item.priority === priority)
      && (!status || (status === "ACTIVE" ? isActive(item.status) : !isActive(item.status)))
      && (!fromDate || day >= fromDate)
      && (!toDate || day <= toDate);
  }), [records, purok, type, priority, status, fromDate, toDate, dateError]);

  useEffect(() => {
    filteredRef.current = filtered;
    if (selectedHotspot) {
      const selectedIds = new Set(selectedHotspot.incidents.map(item => item.id));
      const remaining = filtered.filter(item => selectedHotspot.purokName
        ? item.purokId === selectedHotspot.purokName : selectedIds.has(item.id))
        .sort((a,b) => sosUrgencyRank(b.priority)-sosUrgencyRank(a.priority) || a.createdAt-b.createdAt);
      if (!remaining.length) setSelectedHotspot(null);
      else if (JSON.stringify(remaining) !== JSON.stringify(selectedHotspot.incidents)) {
        setSelectedHotspot({ ...selectedHotspot, title: hotspotTitle(remaining), incidents: remaining });
      }
    }
  }, [filtered, selectedHotspot]);

  const ranking = useMemo(() => {
    const grouped = new Map<string, { count: number; latitude: number; longitude: number; active: number; critical: number; moderate: number }>();
    filtered.forEach((item) => {
      const current = grouped.get(item.purokId) ?? { count: 0, latitude: 0, longitude: 0, active: 0, critical: 0, moderate: 0 };
      current.count += 1;
      if (item.priority === "CRITICAL") current.critical += 1;
      if (item.priority === "MEDIUM") current.moderate += 1;
      current.latitude += item.latitude;
      current.longitude += item.longitude;
      if (isActive(item.status)) current.active += 1;
      grouped.set(item.purokId, current);
    });
    return Array.from(grouped.entries()).map(([name, values]) => ({
      name, count: values.count, active: values.active, critical: values.critical, moderate: values.moderate,
      latitude: values.latitude / values.count, longitude: values.longitude / values.count,
    })).sort((a, b) => b.count - a.count || purokSortValue(a.name) - purokSortValue(b.name) || a.name.localeCompare(b.name));
  }, [filtered]);

  const geojson = useMemo<FeatureCollection<Point>>(() => ({
    type: "FeatureCollection",
    features: filtered.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.longitude, item.latitude] },
      properties: {
        id: item.id,
        purokId: item.purokId,
        type: item.type,
        priority: item.priority,
        status: item.status,
        createdAt: item.createdAt,
      },
    })),
  }), [filtered]);

  const styleUrl = useMemo(() => {
    const configured = import.meta.env.VITE_MAP_STYLE_URL?.trim();
    if (configured) return configured;
    const key = import.meta.env.VITE_MAPTILER_KEY?.trim();
    return key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(key)}` : "";
  }, []);

  function openHotspot(incidentIds: string[], coordinates: [number, number]) {
    const idSet = new Set(incidentIds);
    const incidents = filteredRef.current
      .filter((item) => idSet.has(item.id))
      .sort((a,b) => sosUrgencyRank(b.priority)-sosUrgencyRank(a.priority) || a.createdAt-b.createdAt);
    if (!incidents.length) return;
    setSelectedHotspot({ title: hotspotTitle(incidents), coordinates, incidents });
  }

  useEffect(() => {
    if (!mapContainer.current || !styleUrl) {
      if (!styleUrl) setMapError("The map is not configured. You can still review the Purok table and open incident details.");
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: BUNUANAN_CENTER,
      zoom: 14,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
      map.addSource(HOTSPOT_SOURCE_ID, {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 62,
      });

      map.addLayer({
        id: HEAT_LAYER_ID,
        type: "heatmap",
        source: SOURCE_ID,
        maxzoom: 18,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 18, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 18, 3],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(254,240,138,0)", 0.2, "#fde047", 0.4, "#fb923c", 0.65, "#ef4444", 0.85, "#b91c1c", 1, "#450a0a"],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 18, 42],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0.9, 18, 0.4],
        },
      });

      map.addLayer({
        id: HOTSPOT_CLUSTER_LAYER_ID,
        type: "circle",
        source: HOTSPOT_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#f59e0b", 4, "#ef4444", 8, "#991b1b"],
          "circle-radius": ["step", ["get", "point_count"], 18, 4, 23, 8, 28],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.94,
        },
      });

      map.addLayer({
        id: HOTSPOT_COUNT_LAYER_ID,
        type: "symbol",
        source: HOTSPOT_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 14,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: HOTSPOT_POINT_LAYER_ID,
        type: "circle",
        source: HOTSPOT_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        minzoom: 0,
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "priority"], "CRITICAL", "#B42318", "MEDIUM", "#B45309", "HIGH", "#9F1239", "#475569"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });

      map.on("click", HOTSPOT_CLUSTER_LAYER_ID, async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const clusterId = Number(feature.properties?.cluster_id);
        const pointCount = Number(feature.properties?.point_count) || 100;
        if (!Number.isFinite(clusterId)) return;

        const source = map.getSource(HOTSPOT_SOURCE_ID) as maplibregl.GeoJSONSource;
        try {
          const leaves = await source.getClusterLeaves(clusterId, pointCount, 0);
          const ids = leaves.map((leaf) => String(leaf.properties?.id ?? "")).filter(Boolean);
          const coordinates = feature.geometry.coordinates.slice() as [number, number];
          openHotspot(ids, coordinates);
          const expansionZoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: coordinates, zoom: Math.min(expansionZoom, 16.5), duration: 650 });
        } catch (error) {
          console.error("Unable to open incident hotspot", error);
        }
      });

      map.on("click", HOTSPOT_POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const id = String(feature.properties?.id ?? "");
        if (!id) return;
        openHotspot([id], feature.geometry.coordinates.slice() as [number, number]);
      });

      [HOTSPOT_CLUSTER_LAYER_ID, HOTSPOT_POINT_LAYER_ID].forEach((layerId) => {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      });

      setMapReady(true);
    });

    map.on("error", (event) => setMapError(event.error?.message || "Unable to load the map."));
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Map sources are refreshed by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.setLayoutProperty(HEAT_LAYER_ID, "visibility", mapMode === "density" ? "visible" : "none");
    const rawSource = mapRef.current?.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const hotspotSource = mapRef.current?.getSource(HOTSPOT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    rawSource?.setData(geojson);
    hotspotSource?.setData(geojson);
  }, [geojson, mapReady, mapMode]);

  function focusArea(longitude: number, latitude: number, purokName?: string) {
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, essential: true });
    if (purokName) {
      const incidents = filtered.filter((item) => item.purokId === purokName);
      if (incidents.length) {
        setSelectedHotspot({
          title: purokName,
          purokName,
          coordinates: [longitude, latitude],
          incidents: incidents.sort((a,b) => sosUrgencyRank(b.priority)-sosUrgencyRank(a.priority) || a.createdAt-b.createdAt),
        });
      }
    }
  }

  const activeCount = filtered.filter((item) => isActive(item.status)).length;
  const criticalCount = filtered.filter(item => item.priority === "CRITICAL").length;
  const moderateCount = filtered.filter(item => item.priority === "MEDIUM").length;
  const hotspotActive = selectedHotspot?.incidents.filter((item) => isActive(item.status)).length ?? 0;
  const hotspotClosed = (selectedHotspot?.incidents.length ?? 0) - hotspotActive;
  const hotspotPuroks = selectedHotspot
    ? Array.from(new Set(selectedHotspot.incidents.map((item) => item.purokId))).sort((a, b) => purokSortValue(a) - purokSortValue(b))
    : [];

  return <Stack spacing={2.5} sx={{ "& .MuiInputBase-root": { fontSize: 16 }, "& .MuiTableCell-root": { fontSize: 15, py: 1.5 }, "& .MuiButton-root": { minHeight: 44, fontSize: 15 }, "& .MuiTypography-caption": { fontSize: 14 }, "& .MuiCard-root": { borderRadius: 3, border: "1px solid #DEE5EE", boxShadow: "none" } }}>
    <PageHeader
      eyebrow="Emergency operations • Barangay Bunuanan"
      title="Purok incident heatmap"
      description="Explore where SOS incidents occur. Filter by urgency and Purok, then open an incident for its response details."
      action={<Button variant="outlined" onClick={exportRecords} disabled={loading || Boolean(dataError) || dateError || !filtered.length}>Export CSV</Button>}
    />

    {dataError && <Alert severity="error" action={<Button onClick={() => setRetry(v=>v+1)}>Retry</Button>}>{dataError}</Alert>}
    <Typography color="text.secondary" fontSize={14}>{loading ? "Loading incident records…" : `${filtered.length} mapped incidents match your filters. Dates use Philippine time.`}</Typography>
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      <HeatStat icon={<CrisisAlertRounded />} value={filtered.length} label="Mapped incidents" />
      <HeatStat icon={<LocalFireDepartmentRounded />} value={criticalCount} label="Critical SOS" />
      <HeatStat icon={<MapRounded />} value={activeCount} label="Ongoing response" />
      <HeatStat icon={<CalendarMonthRounded />} value={moderateCount} label="Moderate SOS" />
    </Stack>

    <Card>
      <CardContent>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 1.5 }}>
          <TextField select label="Purok" value={purok} onChange={(e) => setPurok(e.target.value)}><MenuItem value="">All Puroks</MenuItem>{puroks.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
          <TextField select label="Incident type" value={type} onChange={(e) => setType(e.target.value)}><MenuItem value="">All types</MenuItem>{types.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
          <TextField select label="SOS urgency" value={priority} onChange={(e) => setPriority(e.target.value)}><MenuItem value="">All SOS levels</MenuItem>{["CRITICAL", "MEDIUM", "HIGH", "LOW"].map((item) => <MenuItem key={item} value={item}>{sosUrgencyLabel(item)}</MenuItem>)}</TextField>
          <TextField select label="State" value={status} onChange={(e) => setStatus(e.target.value)}><MenuItem value="">All states</MenuItem><MenuItem value="ACTIVE">Ongoing response</MenuItem><MenuItem value="RESOLVED">Response ended</MenuItem></TextField>
          <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Box>
        {dateError && <Alert severity="error" sx={{ mt: 2 }}>From date must be on or before To date.</Alert>}
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 2 }} alignItems="center">
          {purok && <Chip label={purok} onDelete={() => setPurok("")} />}
          {priority && <Chip label={sosUrgencyLabel(priority)} onDelete={() => setPriority("")} />}
          {type && <Chip label={type} onDelete={() => setType("")} />}
          {status && <Chip label={status === "ACTIVE" ? "Ongoing response" : "Response ended"} onDelete={() => setStatus("")} />}
          {(fromDate || toDate) && <Chip label={`${fromDate || "Beginning"} to ${toDate || "Latest"}`} onDelete={() => {setFromDate("");setToDate("");}} />}
          <Button onClick={resetFilters} disabled={![purok,type,priority,status,fromDate,toDate].some(Boolean)}>Reset filters</Button>
        </Stack>
      </CardContent>
    </Card>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.6fr) minmax(410px, 1fr)" }, gap: 2 }}>
      <Card>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ p: 1, mb: 1.5 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>Incident map</Typography>
            <TextField select size="small" label="Map view" value={mapMode} onChange={e=>setMapMode(e.target.value)} sx={{ minWidth: 165 }}>
              <MenuItem value="density">Incident density</MenuItem><MenuItem value="urgency">SOS urgency</MenuItem>
            </TextField>
            <Button startIcon={<MyLocationRounded />} onClick={() => mapRef.current?.flyTo({ center: BUNUANAN_CENTER, zoom: 14 })} disabled={!mapReady}>Center</Button>
          </Stack>
          {mapError && <Alert severity="warning" sx={{ mb: 1.5 }}>{mapError}</Alert>}
          <Box sx={{ position: "relative" }}>
            <Box ref={mapContainer} sx={{ height: { xs: 400, lg: 590 }, borderRadius: 3, overflow: "hidden", bgcolor: "#eef2f6" }} />
            <Chip
              size="small"
              icon={<PlaceRounded />}
              label="Select a point or numbered cluster"
              sx={{ position: "absolute", left: 12, top: 12, bgcolor: "rgba(255,255,255,.94)", boxShadow: 1 }}
            />
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1.25 }} alignItems="center">
            <Box sx={{ width: 110, height: 10, borderRadius: 5, background: "linear-gradient(90deg,#fde047,#fb923c,#ef4444,#7f1d1d)" }} />
            <Typography variant="caption" color="text.secondary">Density colors show incident count, not severity. Cluster numbers show nearby incidents.</Typography>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Chip label="Critical SOS point" sx={{ color: "#B42318", bgcolor: "#FEF3F2" }} />
            <Chip label="Moderate SOS point" sx={{ color: "#92400E", bgcolor: "#FFFBEB" }} />
            <Chip label="Other priority points" variant="outlined" />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Purok overview</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>Current filter results, ranked by incident count. Select View for the incident list.</Typography>
          <TableContainer sx={{ maxHeight: 590 }}>
            <Table stickyHeader size="small">
              <TableHead><TableRow><TableCell>#</TableCell><TableCell>Purok</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Critical</TableCell><TableCell align="right">Moderate</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {ranking.map((item, index) => (
                  <TableRow key={item.name} hover>
                    <TableCell><Chip size="small" color={index === 0 ? "error" : "default"} label={index + 1} /></TableCell>
                    <TableCell><Typography fontWeight={750}>{item.name}</Typography></TableCell>
                    <TableCell align="right">{item.count}</TableCell>
                    <TableCell align="right">{item.critical}</TableCell><TableCell align="right">{item.moderate}</TableCell>
                    <TableCell align="right"><Button size="small" onClick={() => focusArea(item.longitude, item.latitude, item.name)}>View</Button></TableCell>
                  </TableRow>
                ))}
                {!ranking.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>{records.length ? "No mapped incidents match the current filters." : "No Bunuanan SOS incidents with valid GPS coordinates have been recorded yet."}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>

    <Drawer
      anchor="right"
      open={Boolean(selectedHotspot)}
      onClose={() => setSelectedHotspot(null)}
      PaperProps={{ sx: { width: { xs: "100%", sm: 510 }, p: 0 } }}
    >
      {selectedHotspot && (
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ p: 2.25, pb: 1.75 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="overline" color="text.secondary">INCIDENT HOTSPOT</Typography>
                <Typography variant="h5" fontWeight={800}>{selectedHotspot.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selectedHotspot.coordinates[1].toFixed(5)}, {selectedHotspot.coordinates[0].toFixed(5)}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedHotspot(null)} aria-label="Close hotspot details"><CloseRounded /></IconButton>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.75 }}>
              {hotspotPuroks.map((name) => <Chip key={name} size="small" label={name} icon={<PlaceRounded />} />)}
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mt: 2 }}>
              <Card variant="outlined"><CardContent sx={{ p: 1.4, "&:last-child": { pb: 1.4 } }}><Typography variant="h5" fontWeight={800}>{selectedHotspot.incidents.length}</Typography><Typography variant="caption" color="text.secondary">Incidents</Typography></CardContent></Card>
              <Card variant="outlined"><CardContent sx={{ p: 1.4, "&:last-child": { pb: 1.4 } }}><Typography variant="h5" fontWeight={800}>{hotspotActive}</Typography><Typography variant="caption" color="text.secondary">Ongoing</Typography></CardContent></Card>
              <Card variant="outlined"><CardContent sx={{ p: 1.4, "&:last-child": { pb: 1.4 } }}><Typography variant="h5" fontWeight={800}>{hotspotClosed}</Typography><Typography variant="caption" color="text.secondary">Ended</Typography></CardContent></Card>
            </Box>
          </Box>

          <Divider />

          <Box sx={{ p: 2.25, pt: 1.75, overflowY: "auto", flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={800}>Incident details</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Priority and waiting time determine the order. Open a case for response details.</Typography>
            <Stack spacing={1.25}>
              {selectedHotspot.incidents.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
                  <CardContent sx={{ p: 1.6, "&:last-child": { pb: 1.6 } }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                      <Box minWidth={0}>
                        <Typography fontWeight={800} noWrap>{item.type || "SOS Alert"}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.purokId} · {formatDateTime(item.createdAt)}</Typography>
                      </Box>
                      <Chip size="small" label={sosUrgencyLabel(item.priority)} color={priorityColor(item.priority)} />
                    </Stack>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.25 }}>
                      <Chip size="small" variant="outlined" color={isActive(item.status) ? "warning" : "success"} label={item.status || "PENDING"} />
                      <Button size="small" endIcon={<OpenInNewRounded />} onClick={() => navigate(`/emergencies/${item.id}`)}>Open case</Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        </Stack>
      )}
    </Drawer>
  </Stack>;
}
