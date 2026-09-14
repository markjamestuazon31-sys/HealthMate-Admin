import { reportedUrgencyLabel, sosUrgencyLabel } from "../../services/sosUrgency";
import {
  CallRounded,
  CheckCircleRounded,
  CloseRounded,
  HealthAndSafetyOutlined,
  LocationOnRounded,
  MapRounded,
  MedicalInformationOutlined,
  NotificationsActiveRounded,
  OpenInNewRounded,
  PeopleAltOutlined,
  PhoneOutlined,
  SaveRounded,
  ScheduleRounded,
  ShieldOutlined,
} from "@mui/icons-material";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  saveEmergencyAdministrativeDetails,
} from "../../services/emergencyService";
import {
  acknowledgeSosAndNotifyUser,
} from "../../services/notificationService";
import type {
  Emergency,
  EmergencyPriority,
} from "../../types";
import EmergencyAvatar from "./EmergencyAvatar";
import {
  EmergencyPriorityChip,
  EmergencyStatusChip,
  isTerminalStatus,
} from "./EmergencyStatusChip";

const STALE_AFTER_MS = 2 * 60 * 1000;

const ACKNOWLEDGEMENT_PREVIEW =
  "HealthMate has received your emergency alert and the incident is being coordinated. " +
  "Keep your phone available and remain in a safe location when possible.";

function locationFreshness(updatedAt: number) {
  if (!updatedAt) {
    return {
      label: "No location timestamp",
      stale: true,
    };
  }

  const stale =
    Date.now() - updatedAt > STALE_AFTER_MS;

  return {
    label:
      `${new Date(updatedAt).toLocaleString()}` +
      (stale ? " · STALE" : " · LIVE"),
    stale,
  };
}

function DetailLine({
  icon,
  title,
  value,
}: {
  icon: ReactNode;
  title: string;
  value?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.2}
      alignItems="flex-start"
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2.2,
          bgcolor: alpha("#0B7F88", 0.08),
          color: "primary.main",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          color="text.secondary"
          fontSize={11.5}
          fontWeight={800}
          textTransform="uppercase"
          letterSpacing={0.65}
        >
          {title}
        </Typography>

        <Typography
          fontWeight={700}
          sx={{
            mt: 0.2,
            overflowWrap: "anywhere",
          }}
        >
          {value || "Not available"}
        </Typography>
      </Box>
    </Stack>
  );
}

function MedicalItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <Box>
      <Typography
        color="text.secondary"
        fontSize={11.5}
        fontWeight={800}
        textTransform="uppercase"
        letterSpacing={0.6}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.35,
          whiteSpace: "pre-wrap",
        }}
      >
        {value || "Not recorded"}
      </Typography>
    </Box>
  );
}

export default function EmergencyDialog({
  open,
  emergency,
  close,
}: {
  open: boolean;
  emergency: Emergency | null;
  close: () => void;
}) {
  const navigate = useNavigate();

  const [note, setNote] = useState("");
  const [urgencyReason, setUrgencyReason] = useState("");
  const [basePriority, setBasePriority] = useState<EmergencyPriority>("HIGH");
  const [priority, setPriority] =
    useState<EmergencyPriority>("HIGH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!emergency) {
      return;
    }

    setNote(emergency.responseNotes ?? "");
    setPriority(emergency.priority);
    setBasePriority(emergency.priority);
    setUrgencyReason("");
    setError("");
    setSuccess("");
  }, [emergency?.id, open]);

  if (!emergency) {
    return null;
  }

  const currentEmergency = emergency;
  const team = Object.values(
    emergency.responders ?? {},
  ).sort((first, second) => {
    if (first.teamRole !== second.teamRole) {
      return first.teamRole === "COORDINATOR"
        ? -1
        : 1;
    }

    return first.acceptedAt - second.acceptedAt;
  });

  const activeTeam = team.filter(
    (item) => item.active,
  );
  const freshness = locationFreshness(
    emergency.location.updatedAt,
  );
  const terminal = isTerminalStatus(
    emergency.status,
  );
  const coordinatesAvailable =
    Number.isFinite(emergency.location.latitude) &&
    Number.isFinite(emergency.location.longitude) &&
    !(
      emergency.location.latitude === 0 &&
      emergency.location.longitude === 0
    );
  const acknowledged =
    Boolean(emergency.adminAcknowledgedAt);
  const secured =
    emergency.arrivalVerified === true ||
    String(emergency.alertState ?? "")
      .trim()
      .toUpperCase() === "SECURED";

  async function acknowledgeAndNotify(): Promise<void> {
    if (currentEmergency.priority !== basePriority) {
      setError("SOS urgency changed while this form was open. Close and reopen the incident to load the latest priority.");
      return;
    }
    if (terminal) {
      setError(
        "This incident is already closed or cancelled.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result =
        await acknowledgeSosAndNotifyUser({
          incidentId: currentEmergency.id,
          note,
          priority,
          urgencyReason,
        });

      if (result.alreadyAcknowledged) {
        setSuccess(
          "This SOS was already acknowledged. No duplicate patient notification was created.",
        );
      } else {
        setSuccess(
          "SOS acknowledged. The patient inbox was updated and the high-priority phone notification was queued.",
        );
      }
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to acknowledge the SOS.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAdministrativeNote(): Promise<void> {
    if (currentEmergency.priority !== basePriority) {
      setError("SOS urgency changed while this form was open. Close and reopen the incident to load the latest priority.");
      return;
    }
    if (terminal) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveEmergencyAdministrativeDetails(
        currentEmergency,
        {
          priority,
          urgencyReason,
          responseNotes: note,
        },
      );

      setSuccess(
        "Administrative note and SOS urgency saved. Connected apps will receive the update.",
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the administrative note.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openMap(): void {
    close();
    navigate(
      `/map?incidentId=${encodeURIComponent(
        currentEmergency.id,
      )}`,
    );
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : close}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            position: "relative",
            p: {
              xs: 2.5,
              sm: 3.25,
            },
            color: "common.white",
            background: terminal
              ? "linear-gradient(135deg, #344054 0%, #475467 100%)"
              : "linear-gradient(135deg, #7A271A 0%, #B42318 56%, #D92D20 100%)",
          }}
        >
          <IconButton
            onClick={close}
            disabled={saving}
            aria-label="Close incident"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              color: "common.white",
              bgcolor: alpha("#FFFFFF", 0.1),
              "&:hover": {
                bgcolor: alpha("#FFFFFF", 0.18),
              },
            }}
          >
            <CloseRounded />
          </IconButton>

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={2.25}
            alignItems={{ sm: "center" }}
          >
            <EmergencyAvatar
              name={emergency.patientName}
              profileImage={
                emergency.patientProfile
                  ?.profileImage
              }
              size={86}
              active={!terminal}
              pulse={!terminal}
            />

            <Box
              sx={{
                minWidth: 0,
                flexGrow: 1,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 0.8 }}
              >
                {!terminal && (
                  <Chip
                    size="small"
                    label="ACTIVE SOS"
                    sx={{
                      bgcolor: alpha(
                        "#FFFFFF",
                        0.16,
                      ),
                      color: "white",
                      fontWeight: 900,
                    }}
                  />
                )}

                {secured && (
                  <Chip
                    size="small"
                    label="RESPONDENT ARRIVAL VERIFIED"
                    sx={{
                      bgcolor: alpha(
                        "#FFFFFF",
                        0.16,
                      ),
                      color: "white",
                      fontWeight: 900,
                    }}
                  />
                )}

                <Chip
                  size="small"
                  label={`INCIDENT ${emergency.id
                    .slice(-8)
                    .toUpperCase()}`}
                  sx={{
                    bgcolor: alpha(
                      "#FFFFFF",
                      0.12,
                    ),
                    color: "white",
                    fontWeight: 800,
                  }}
                />
              </Stack>

              <Typography
                variant="h4"
                color="inherit"
                sx={{ letterSpacing: -0.8 }}
              >
                {emergency.patientName ||
                  "Unknown HealthMate user"}
              </Typography>

              <Typography
                sx={{
                  color: alpha(
                    "#FFFFFF",
                    0.78,
                  ),
                  mt: 0.5,
                }}
              >
                {emergency.type}
                {" · received "}
                {new Date(
                  emergency.createdAt,
                ).toLocaleString()}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              {emergency.patientPhone && (
                <Button
                  component="a"
                  href={`tel:${emergency.patientPhone}`}
                  variant="contained"
                  startIcon={<CallRounded />}
                  sx={{
                    bgcolor: "white",
                    color: "error.dark",
                    "&:hover": {
                      bgcolor: "grey.100",
                    },
                  }}
                >
                  Call patient
                </Button>
              )}

              <Button
                onClick={openMap}
                variant="outlined"
                startIcon={<MapRounded />}
                sx={{
                  borderColor: alpha(
                    "#FFFFFF",
                    0.55,
                  ),
                  color: "white",
                  "&:hover": {
                    borderColor: "white",
                    bgcolor: alpha(
                      "#FFFFFF",
                      0.08,
                    ),
                  },
                }}
              >
                Open live map
              </Button>
            </Stack>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          p: {
            xs: 2.25,
            sm: 3,
          },
        }}
      >
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success">
              {success}
            </Alert>
          )}

          {!terminal && !acknowledged && (
            <Alert
              severity="info"
              icon={
                <NotificationsActiveRounded />
              }
            >
              <strong>
                Patient notification on acknowledgement:
              </strong>{" "}
              {ACKNOWLEDGEMENT_PREVIEW}
            </Alert>
          )}

          {acknowledged && (
            <Alert
              severity="success"
              icon={<CheckCircleRounded />}
            >
              Administrator acknowledged this SOS
              {emergency.adminAcknowledgedAt
                ? ` on ${new Date(
                    emergency.adminAcknowledgedAt,
                  ).toLocaleString()}`
                : ""}
              .
            </Alert>
          )}

          {activeTeam.length > 0 && (
            <Alert severity="info">
              {activeTeam.length === 1
                ? "A respondent has accepted this SOS. The Android respondent flow automatically notifies the patient that a respondent is coming and starts response-team tracking."
                : `${activeTeam.length} respondents are active on this incident. Respondent acceptance notifications are generated by the Android response flow, so the admin portal does not send duplicate \"respondent is coming\" alerts.`}
            </Alert>
          )}

          {freshness.stale &&
            !terminal &&
            !secured && (
              <Alert
                severity="warning"
                icon={<ScheduleRounded />}
              >
                The patient GPS is stale. The SOS
                remains on the live map using the
                last known location until the user
                stops the SOS or a respondent
                verifies arrival by scanning the
                active SOS QR.
              </Alert>
            )}

          {secured && (
            <Alert severity="warning">
              Respondent arrival was verified by QR.
              The responder is on scene, but the emergency remains ACTIVE and
              retains its urgency on the live map until the incident is formally completed,
              cancelled, or closed.
            </Alert>
          )}

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
          >
            <EmergencyPriorityChip
              priority={emergency.priority}
            />
            <EmergencyStatusChip
              status={emergency.status}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<PeopleAltOutlined />}
              label={`${activeTeam.length} active responders`}
            />
            <Chip
              size="small"
              variant="outlined"
              icon={<ShieldOutlined />}
              label={`${emergency.recipientCount ?? 0} authorized recipients`}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ p: 2 }}
            >
              <DetailLine
                icon={
                  <PhoneOutlined fontSize="small" />
                }
                title="Patient contact"
                value={
                  emergency.patientPhone ||
                  emergency.patientProfile?.email
                }
              />
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: 2 }}
            >
              <DetailLine
                icon={
                  <LocationOnRounded fontSize="small" />
                }
                title="Emergency area"
                value={
                  emergency.locationSummary
                    .barangayName ||
                  emergency.assignedBarangayId ||
                  emergency.patientProfile?.address
                }
              />
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: 2 }}
            >
              <DetailLine
                icon={
                  <ScheduleRounded fontSize="small" />
                }
                title="Location freshness"
                value={freshness.label}
              />
            </Paper>
          </Box>

          <Card variant="outlined">
            <CardContent sx={{ p: 2.25 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={2}
              >
                <Box>
                  <Typography fontWeight={850}>
                    Incident description
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{
                      mt: 0.7,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.65,
                    }}
                  >
                    {emergency.description}
                  </Typography>
                </Box>
                <HealthAndSafetyOutlined color="error" />
              </Stack>

              {coordinatesAvailable && (
                <Typography
                  color="text.secondary"
                  fontSize={12.5}
                  sx={{ mt: 1.5 }}
                >
                  Coordinates:{" "}
                  {emergency.location.latitude.toFixed(
                    6,
                  )}
                  ,{" "}
                  {emergency.location.longitude.toFixed(
                    6,
                  )}
                  {freshness.stale
                    ? " · last known position"
                    : ""}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1.25 }}
            >
              <MedicalInformationOutlined color="primary" />
              <Typography variant="h6">
                Emergency medical summary
              </Typography>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2.25,
                bgcolor: alpha(
                  "#0B7F88",
                  0.025,
                ),
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <MedicalItem
                  label="Blood type"
                  value={
                    emergency.medicalSummary
                      ?.bloodType
                  }
                />
                <MedicalItem
                  label="Allergies"
                  value={
                    emergency.medicalSummary
                      ?.allergies
                  }
                />
                <MedicalItem
                  label="Conditions"
                  value={
                    emergency.medicalSummary
                      ?.conditions ||
                    emergency.medicalSummary
                      ?.medicalConditions
                  }
                />
                <MedicalItem
                  label="Medications"
                  value={
                    emergency.medicalSummary
                      ?.medications
                  }
                />
                <Box
                  sx={{
                    gridColumn: {
                      sm: "span 2",
                    },
                  }}
                >
                  <MedicalItem
                    label="Emergency note"
                    value={
                      emergency.medicalSummary
                        ?.emergencyNote
                    }
                  />
                </Box>
              </Box>
            </Paper>
          </Box>

          <Divider />

          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.25 }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
              >
                <PeopleAltOutlined color="primary" />
                <Typography variant="h6">
                  Response team
                </Typography>
              </Stack>

              <Chip
                size="small"
                label={`${activeTeam.length} active`}
                color={
                  activeTeam.length > 0
                    ? "success"
                    : "default"
                }
                variant="outlined"
              />
            </Stack>

            {team.length === 0 ? (
              <Alert severity="info">
                No respondent has accepted this
                incident yet.
              </Alert>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.25,
                }}
              >
                {team.map((response) => (
                  <Card
                    key={response.responderUid}
                    variant="outlined"
                  >
                    <CardContent
                      sx={{
                        p: 2,
                        "&:last-child": {
                          pb: 2,
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        spacing={1.25}
                        alignItems="flex-start"
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            fontWeight={850}
                          >
                            {response.responderName ||
                              response.responderUid}
                          </Typography>
                          <Typography
                            color="text.secondary"
                            fontSize={12.5}
                            sx={{ mt: 0.3 }}
                          >
                            {response.teamRole}
                            {" · "}
                            {response.responseStatus.replace(
                              /_/g,
                              " ",
                            )}
                          </Typography>
                        </Box>

                        <Chip
                          size="small"
                          color={
                            response.active
                              ? "success"
                              : "default"
                          }
                          label={
                            response.active
                              ? "ACTIVE"
                              : "WITHDRAWN"
                          }
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>

          <Divider />

          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1.25 }}
            >
              <ShieldOutlined color="primary" />
              <Typography variant="h6">
                Administrative control
              </Typography>
            </Stack>

            <Alert
              severity="info"
              sx={{ mb: 1.5 }}
            >
              Responders update response progress. Administrators acknowledge SOS requests, review urgency and reports, and close completed incidents.
            </Alert>

            <Stack spacing={1.5}>
              <TextField
                select
                fullWidth
                label="SOS urgency"
                value={priority}
                disabled={terminal || saving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPriority(
                    event.target
                      .value as EmergencyPriority,
                  )
                }
              >
                {(
                  [
                    "CRITICAL",
                    "HIGH",
                    "MEDIUM",
                    "LOW",
                  ] as EmergencyPriority[]
                ).map((item) => (
                  <MenuItem
                    key={item}
                    value={item}
                  >
                    {sosUrgencyLabel(item)}
                  </MenuItem>
                ))}
              </TextField>

              {priority !== currentEmergency.priority && <TextField fullWidth required multiline minRows={2}
                label="Reason for urgency change" value={urgencyReason} disabled={terminal || saving}
                onChange={event => setUrgencyReason(event.target.value)} inputProps={{ maxLength: 1000 }}
                helperText="Record the assessment or information supporting this change." />}
              <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Typography fontWeight={750}>Reported urgency</Typography>
                <Typography sx={{ mt: 0.5 }}>{reportedUrgencyLabel(currentEmergency.reportedUrgency)}</Typography>
                <Typography color="text.secondary" fontSize={14} sx={{ mt: 0.5 }}>
                  The original resident selection is kept when the response priority changes.
                </Typography>
                {Object.entries(currentEmergency.urgencyHistory ?? {}).sort((a,b) => b[1].at-a[1].at).map(([id, entry]) => (
                  <Box key={id} sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                    <Typography fontWeight={700}>{sosUrgencyLabel(entry.previous)} → {sosUrgencyLabel(entry.current)}</Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>{entry.reason}</Typography>
                    <Typography color="text.secondary" fontSize={14}>{new Date(entry.at).toLocaleString()} · Admin {entry.actorUid}</Typography>
                  </Box>
                ))}
              </Box>
              <TextField
                multiline
                minRows={3}
                label="Administrative response notes"
                value={note}
                disabled={terminal || saving}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setNote(event.target.value)
                }
                helperText="Internal operational note. It is stored in the incident record and audit trail; it is not used as the patient notification text."
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: {
            xs: 2.25,
            sm: 3,
          },
          py: 2.25,
          borderTop: "1px solid",
          borderColor: "divider",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Button
          onClick={openMap}
          startIcon={<OpenInNewRounded />}
        >
          View map
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          onClick={close}
          disabled={saving}
        >
          Close
        </Button>

        {!terminal && acknowledged && (
          <Button
            variant="outlined"
            startIcon={<SaveRounded />}
            onClick={saveAdministrativeNote}
            disabled={saving}
          >
            Save changes
          </Button>
        )}

        {!terminal && !acknowledged && (
          <Button
            variant="contained"
            color="error"
            startIcon={
              saving
                ? undefined
                : <NotificationsActiveRounded />
            }
            onClick={acknowledgeAndNotify}
            disabled={saving}
          >
            {saving ? (
              <CircularProgress
                size={20}
                color="inherit"
              />
            ) : (
              "Acknowledge SOS & notify user"
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
