import {
  ArticleOutlined,
  AssessmentOutlined,
  CampaignOutlined,
  CloudDoneOutlined,
  ContactPhoneOutlined,
  DownloadRounded,
  ExpandMoreRounded,
  GroupsOutlined,
  HistoryOutlined,
  HomeWorkOutlined,
  LocalHospitalOutlined,
  PrintRounded,
  RefreshRounded,
  SearchRounded,
  SupportAgentOutlined,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
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
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import {
  listenSystemReportData,
  type SystemReportData,
} from "../services/reportService";
import {
  buildGeneratedReport,
  downloadReportCsv,
  printGeneratedReport,
  REPORT_CATALOG,
  type GeneratedReport,
  type ReportFilters,
  type ReportMetric,
  type ReportType,
} from "../utils/reportGenerator";

const EMPTY_DATA: SystemReportData = {
  emergencies: [],
  rescueReports: [],
  users: [],
  households: [],
  inhabitants: [],
  respondentApplications: [],
  respondentInvitations: [],
  responders: [],
  directoryContacts: [],
  announcements: [],
  auditLogs: [],
};

const DEFAULT_FILTERS: ReportFilters = {
  startDate: "",
  endDate: "",
  search: "",
};

const PREVIEW_LIMIT = 18;

function reportIcon(type: ReportType) {
  switch (type) {
    case "complete":
      return <AssessmentOutlined />;
    case "emergencies":
      return <LocalHospitalOutlined />;
    case "rescue":
      return <ArticleOutlined />;
    case "residents":
      return <GroupsOutlined />;
    case "population":
      return <HomeWorkOutlined />;
    case "responders":
      return <SupportAgentOutlined />;
    case "directory":
      return <ContactPhoneOutlined />;
    case "announcements":
      return <CampaignOutlined />;
    case "audit":
      return <HistoryOutlined />;
  }
}

function metricColors(tone: ReportMetric["tone"]) {
  switch (tone) {
    case "error":
      return { main: "#D92D20", soft: "#FFF1F0" };
    case "success":
      return { main: "#039855", soft: "#ECFDF3" };
    case "warning":
      return { main: "#DC6803", soft: "#FFFAEB" };
    case "neutral":
      return { main: "#52667A", soft: "#F5F7FA" };
    default:
      return { main: "#B42318", soft: "#FFF1F0" };
  }
}

function MetricCard({ metric }: { metric: ReportMetric }) {
  const colors = metricColors(metric.tone);
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        minHeight: 116,
        borderRadius: 3,
        borderColor: alpha(colors.main, 0.16),
        bgcolor: colors.soft,
        boxShadow: "none",
      }}
    >
      <Typography
        sx={{
          color: "text.secondary",
          fontSize: 10.5,
          fontWeight: 850,
          letterSpacing: 0.65,
          textTransform: "uppercase",
        }}
      >
        {metric.label}
      </Typography>
      <Typography
        sx={{
          mt: 0.6,
          color: colors.main,
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: -0.8,
        }}
      >
        {metric.value}
      </Typography>
      {metric.helper && (
        <Typography color="text.secondary" fontSize={11.5} sx={{ mt: 0.65 }}>
          {metric.helper}
        </Typography>
      )}
    </Paper>
  );
}

function ReportPreview({ report }: { report: GeneratedReport }) {
  return (
    <Stack spacing={2.25}>
      {report.sections.map((section, index) => {
        const previewRows = section.rows.slice(0, PREVIEW_LIMIT);
        const truncated = section.rows.length > PREVIEW_LIMIT;

        return (
          <Accordion
            key={section.id}
            defaultExpanded={index === 0}
            disableGutters
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "18px !important",
              overflow: "hidden",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRounded />}
              sx={{
                minHeight: 68,
                px: { xs: 2, sm: 2.5 },
                bgcolor: "#F8FAFC",
                borderBottom: "1px solid",
                borderColor: "divider",
                "& .MuiAccordionSummary-content": { my: 1.4 },
              }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography fontWeight={880} color="text.primary">
                    {section.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${section.rows.length} record${section.rows.length === 1 ? "" : "s"}`}
                    sx={{ bgcolor: "#FFF1F0", color: "#B42318", fontWeight: 850 }}
                  />
                </Stack>
                {section.description && (
                  <Typography color="text.secondary" fontSize={11.5} sx={{ mt: 0.3 }}>
                    {section.description}
                  </Typography>
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table stickyHeader size="small" sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow>
                      {section.columns.map((column) => (
                        <TableCell key={column.key} align={column.align ?? "left"}>
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.length ? (
                      previewRows.map((row, rowIndex) => (
                        <TableRow key={`${section.id}-${rowIndex}`} hover>
                          {section.columns.map((column) => (
                            <TableCell
                              key={column.key}
                              align={column.align ?? "left"}
                              sx={{
                                fontSize: 12,
                                color: "text.primary",
                                maxWidth: column.key === "details" ? 360 : 260,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {String(row[column.key] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={section.columns.length} align="center" sx={{ py: 5 }}>
                          <Typography color="text.secondary" fontSize={13}>
                            No records match the selected report filters.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {truncated && (
                <Box sx={{ px: 2, py: 1.25, bgcolor: "#F8FAFC", borderTop: "1px solid", borderColor: "divider" }}>
                  <Typography color="text.secondary" fontSize={11.5}>
                    Preview shows the first {PREVIEW_LIMIT} rows. Print and CSV export include all {section.rows.length} records in this section.
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("complete");
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<SystemReportData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [generatedSourceAt, setGeneratedSourceAt] = useState(0);
  const [message, setMessage] = useState<{ severity: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    return listenSystemReportData((snapshot) => {
      setData(snapshot.data);
      setReady(snapshot.ready);
      setSyncedAt(snapshot.syncedAt);
    });
  }, []);

  const selectedDefinition = REPORT_CATALOG.find((item) => item.id === reportType) ?? REPORT_CATALOG[0];
  const stale = Boolean(generated && generatedSourceAt && syncedAt > generatedSourceAt);

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function createReport(type = reportType) {
    try {
      const report = buildGeneratedReport(type, data, filters);
      setGenerated(report);
      setGeneratedSourceAt(syncedAt || Date.now());
      setMessage({
        severity: "success",
        text: `${report.title} generated with ${report.totalRows} matching record${report.totalRows === 1 ? "" : "s"}.`,
      });
      return report;
    } catch (caught) {
      setMessage({
        severity: "error",
        text: caught instanceof Error ? caught.message : "Unable to generate the report.",
      });
      return null;
    }
  }

  function printReport(report: GeneratedReport | null) {
    if (!report) return;
    try {
      printGeneratedReport(report);
    } catch (caught) {
      setMessage({
        severity: "error",
        text: caught instanceof Error ? caught.message : "Unable to open the print report.",
      });
    }
  }

  function printCompleteReport() {
    const report = createReport("complete");
    if (report) printReport(report);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setMessage({ severity: "info", text: "Report filters cleared. Generate the report again to refresh the preview." });
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Administrative intelligence"
        title="Reports center"
        description="Generate formal system reports from live HealthMate records, filter by reporting period, preview before release, export to CSV, or print and save as PDF."
        action={
          <Button
            variant="contained"
            startIcon={<PrintRounded />}
            onClick={printCompleteReport}
            disabled={!ready}
            sx={{ minHeight: 44, px: 2.1 }}
          >
            Print complete system report
          </Button>
        }
      />

      <Paper
        sx={{
          position: "relative",
          overflow: "hidden",
          p: { xs: 2.25, md: 3 },
          borderRadius: 4,
          color: "#FFFFFF",
          background: "linear-gradient(120deg, #7A271A 0%, #B42318 50%, #D92D20 100%)",
          boxShadow: "0 18px 48px rgba(122, 39, 26, 0.20)",
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            right: -95,
            top: -165,
            bgcolor: alpha("#FFFFFF", 0.08),
          }}
        />
        <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems={{ md: "center" }}>
          <Box
            sx={{
              width: 58,
              height: 58,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 3,
              bgcolor: alpha("#FFFFFF", 0.14),
              border: `1px solid ${alpha("#FFFFFF", 0.2)}`,
            }}
          >
            <AssessmentOutlined sx={{ fontSize: 30 }} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" color="white">
              System-wide reporting and print control
            </Typography>
            <Typography sx={{ mt: 0.65, maxWidth: 850, color: alpha("#FFFFFF", 0.76), lineHeight: 1.65, fontSize: 13 }}>
              One reporting workspace for emergency operations, rescue outcomes, population records, respondent authorization, emergency contacts, communications, and administrative audit history.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              icon={ready ? <CloudDoneOutlined /> : <CircularProgress size={14} color="inherit" />}
              label={ready ? "All report sources synchronized" : "Synchronizing report sources"}
              sx={{ bgcolor: alpha("#FFFFFF", 0.14), color: "white", border: `1px solid ${alpha("#FFFFFF", 0.2)}` }}
            />
            {syncedAt > 0 && (
              <Chip
                label={`Live sync ${new Date(syncedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
                sx={{ bgcolor: alpha("#FFFFFF", 0.1), color: alpha("#FFFFFF", 0.85) }}
              />
            )}
          </Stack>
        </Stack>
      </Paper>

      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Box>
        <Stack direction="row" spacing={1.1} alignItems="center">
          <Box
            sx={{
              width: 4,
              height: 27,
              borderRadius: 99,
              bgcolor: "primary.main",
              boxShadow: `0 0 0 4px ${alpha("#D92D20", 0.07)}`,
            }}
          />
          <Typography variant="h6">Choose a report</Typography>
        </Stack>
        <Typography color="text.secondary" fontSize={12.5} sx={{ mt: 0.35, mb: 1.5 }}>
          Each report uses the same normalized Firebase data as its operational HealthMate screen.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          {REPORT_CATALOG.map((item) => {
            const selected = reportType === item.id;
            return (
              <Card
                key={item.id}
                sx={{
                  height: "100%",
                  borderColor: selected ? "primary.main" : "divider",
                  boxShadow: selected ? `0 10px 30px ${alpha("#D92D20", 0.14)}` : "0 6px 20px rgba(16,42,67,0.04)",
                }}
              >
                <CardActionArea
                  onClick={() => setReportType(item.id)}
                  sx={{ height: "100%", alignItems: "stretch" }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 2.4,
                          bgcolor: selected ? "primary.main" : "#FFF1F0",
                          color: selected ? "white" : "primary.main",
                          "& .MuiSvgIcon-root": { fontSize: 22 },
                        }}
                      >
                        {reportIcon(item.id)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={870} fontSize={13.5} color="text.primary">
                          {item.shortTitle}
                        </Typography>
                        <Typography color="text.secondary" fontSize={10.8} sx={{ mt: 0.45, lineHeight: 1.5 }}>
                          {item.description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3.5,
          boxShadow: "0 8px 28px rgba(16,42,67,0.045)",
        }}
      >
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "flex-end" }}>
          <Box sx={{ minWidth: 220, flexGrow: 1 }}>
            <Typography fontWeight={880} color="text.primary">
              {selectedDefinition.title}
            </Typography>
            <Typography color="text.secondary" fontSize={11.5} sx={{ mt: 0.25 }}>
              Configure the reporting period and optional search filter before generating.
            </Typography>
          </Box>

          <TextField
            label="Start date"
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter("startDate", event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: "100%", sm: 180 } }}
          />
          <TextField
            label="End date"
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter("endDate", event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: "100%", sm: 180 } }}
          />
          <TextField
            label="Search report records"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Name, status, incident, purok…"
            sx={{ width: { xs: "100%", lg: 300 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={resetFilters}>
              Reset
            </Button>
            <Button variant="contained" onClick={() => createReport()} disabled={!ready}>
              Generate report
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {!ready && (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3.5, textAlign: "center" }}>
          <CircularProgress size={34} />
          <Typography fontWeight={850} sx={{ mt: 1.5 }}>
            Synchronizing system report sources
          </Typography>
          <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.4 }}>
            The report generator will be available when the administration datasets have completed their first live sync.
          </Typography>
        </Paper>
      )}

      {ready && !generated && (
        <Paper
          variant="outlined"
          sx={{
            minHeight: 250,
            p: 4,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            borderRadius: 3.5,
            borderStyle: "dashed",
            bgcolor: "#FAFCFF",
          }}
        >
          <Box>
            <Box
              sx={{
                width: 58,
                height: 58,
                mx: "auto",
                display: "grid",
                placeItems: "center",
                borderRadius: 3,
                bgcolor: "#FFF1F0",
                color: "primary.main",
              }}
            >
              <ArticleOutlined sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h6" sx={{ mt: 1.4 }}>
              Ready to generate
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 600 }}>
              Choose a report, set optional filters, then generate a formal preview. Printing and CSV export are enabled after generation.
            </Typography>
          </Box>
        </Paper>
      )}

      {generated && (
        <Stack spacing={2.25}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3.5,
              borderColor: alpha("#D92D20", 0.22),
              boxShadow: "0 10px 34px rgba(16,42,67,0.055)",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography variant="h6">{generated.title}</Typography>
                  <Chip size="small" label={`${generated.totalRows} total rows`} color="primary" variant="outlined" />
                  {stale && <Chip size="small" label="New live data available" color="warning" />}
                </Stack>
                <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.5 }}>
                  Generated {new Date(generated.generatedAt).toLocaleString("en-PH")} · {generated.periodLabel}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {stale && (
                  <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => createReport(generated.type)}>
                    Regenerate
                  </Button>
                )}
                <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => downloadReportCsv(generated)}>
                  Export CSV
                </Button>
                <Button variant="contained" startIcon={<PrintRounded />} onClick={() => printReport(generated)}>
                  Print / Save PDF
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            {generated.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </Box>

          <ReportPreview report={generated} />

          <Alert severity="info" icon={<PrintRounded fontSize="inherit" />}>
            <strong>Print / Save PDF</strong> opens a formal A4 landscape report containing all matching rows, not only the on-screen preview. Use your browser's print destination to select a physical printer or “Save as PDF”.
          </Alert>
        </Stack>
      )}
    </Stack>
  );
}
