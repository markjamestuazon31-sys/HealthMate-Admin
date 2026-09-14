import {
  ArticleOutlined,
  BadgeOutlined,
  CheckCircleRounded,
  CloseRounded,
  HowToRegOutlined,
  OpenInNewOutlined,
  PersonOutlined,
  SaveRounded,
  VerifiedOutlined,
  WarningAmberRounded,
} from "@mui/icons-material";

import {
  Alert,
  Avatar,
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { alpha } from "@mui/material/styles";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  listenBarangays,
} from "../../services/directoryService";

import {
  loadRespondentApplicationDocuments,
  reviewRespondentApplication,
} from "../../services/respondentApplicationService";

import type {
  Barangay,
  RespondentApplication,
  RespondentApplicationDocuments,
  RespondentApplicationStatus,
} from "../../types";

import {
  mobileProfileImageSource,
} from "../../utils/imageData";

const REVIEW_STATUSES: Array<{
  value: RespondentApplicationStatus;
  label: string;
}> = [
  {
    value: "pending_review",
    label: "Pending review",
  },
  {
    value: "under_verification",
    label: "Under verification",
  },
  {
    value: "additional_documents_required",
    label: "Request additional documents",
  },
  {
    value: "approved",
    label: "Approve respondent",
  },
  {
    value: "rejected",
    label: "Reject application",
  },
  {
    value: "suspended",
    label: "Suspend application",
  },
  {
    value: "deactivated",
    label: "Deactivate account",
  },
];

const DEFAULT_APPROVAL_MESSAGE =
  "Your HealthMate respondent application has been approved. " +
  "Your respondent account is now active. Sign in to receive " +
  "authorized emergency assignments.";

function safeText(
  value: unknown,
  fallback = "",
): string {
  const normalized =
    String(value ?? "").trim();

  return normalized || fallback;
}

function formatStatus(
  value: unknown,
): string {
  return safeText(
    value,
    "pending_review",
  )
    .replace(/_/g, " ")
    .toUpperCase();
}

function formatRole(
  value: unknown,
): string {
  return safeText(
    value,
    "Not specified",
  ).replace(/_/g, " ");
}

interface DocumentPreviewProps {
  title: string;
  icon: ReactNode;
  base64Data?: string;
}

function DocumentPreview({
  title,
  icon,
  base64Data,
}: DocumentPreviewProps) {
  const source =
    mobileProfileImageSource(
      base64Data,
    );

  function openFullImage(): void {
    if (!source) {
      return;
    }

    window.open(
      source,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <Card variant="outlined">
      <CardContent
        sx={{
          p: 1.5,
          "&:last-child": {
            pb: 1.5,
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            mb: 1,
          }}
        >
          {icon}

          <Typography fontWeight={800}>
            {title}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            size="small"
            label={
              source
                ? "UPLOADED"
                : "MISSING"
            }
            color={
              source
                ? "success"
                : "error"
            }
            variant="outlined"
          />
        </Stack>

        {source ? (
          <Box
            component="img"
            src={source}
            alt={title}
            sx={{
              width: "100%",
              height: 210,
              objectFit: "contain",
              bgcolor: "grey.50",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          />
        ) : (
          <Box
            sx={{
              height: 210,
              display: "grid",
              placeItems: "center",
              bgcolor: "grey.50",
              borderRadius: 2,
              border: "1px dashed",
              borderColor: "divider",
            }}
          >
            <Typography color="text.secondary">
              No image supplied
            </Typography>
          </Box>
        )}

        {source && (
          <Button
            size="small"
            startIcon={
              <OpenInNewOutlined />
            }
            sx={{
              mt: 1,
            }}
            onClick={openFullImage}
          >
            Open full image
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface ApplicationReviewDialogProps {
  application:
    RespondentApplication | null;

  close: () => void;

  /**
   * Called only after the approval write succeeds.
   * The parent should close the dialog and switch
   * to the Registered respondents tab.
   */
  onApproved?: () => void;
}

export default function ApplicationReviewDialog({
  application,
  close,
  onApproved,
}: ApplicationReviewDialogProps) {
  const [
    barangays,
    setBarangays,
  ] = useState<Barangay[]>([]);

  const [
    status,
    setStatus,
  ] =
    useState<RespondentApplicationStatus>(
      "under_verification",
    );

  const [
    approvedRole,
    setApprovedRole,
  ] = useState("");

  const [
    assignedBarangayId,
    setAssignedBarangayId,
  ] = useState("");

  const [
    serviceArea,
    setServiceArea,
  ] = useState("");

  const [
    reviewMessage,
    setReviewMessage,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    documents,
    setDocuments,
  ] =
    useState<RespondentApplicationDocuments>(
      {},
    );

  const [
    documentsLoading,
    setDocumentsLoading,
  ] = useState(false);

  useEffect(() => {
    const unsubscribe =
      listenBarangays((items) => {
        setBarangays(
          items.filter(
            (item) =>
              item.active,
          ),
        );
      });

    return typeof unsubscribe ===
      "function"
      ? unsubscribe
      : undefined;
  }, []);

  useEffect(() => {
    if (!application) {
      setDocuments({});
      setDocumentsLoading(false);
      setError("");
      setSuccess("");
      return undefined;
    }

    let active = true;

    setStatus(
      application.status ||
        "under_verification",
    );

    setApprovedRole(
      application.approvedRole ||
        application.requestedRole ||
        "",
    );

    setAssignedBarangayId(
      application.assignedBarangayId ||
        application.barangayId ||
        "",
    );

    setServiceArea(
      application.serviceArea ||
        "",
    );

    setReviewMessage(
      application.reviewMessage ||
        "",
    );

    setError("");
    setSuccess("");
    setDocuments({});
    setDocumentsLoading(true);

    const applicantUid =
      safeText(
        application.applicantUid ||
          application.id,
      );

    if (!applicantUid) {
      setDocumentsLoading(false);

      setError(
        "The respondent application has no applicant user ID.",
      );

      return () => {
        active = false;
      };
    }

    loadRespondentApplicationDocuments(
      applicantUid,
    )
      .then((value) => {
        if (!active) {
          return;
        }

        setDocuments(
          value ?? {},
        );
      })
      .catch(
        (caught: unknown) => {
          if (!active) {
            return;
          }

          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the applicant documents.",
          );
        },
      )
      .finally(() => {
        if (active) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [application]);

  const approvalReadiness =
    useMemo(() => {
      const missing: string[] =
        [];

      if (
        !documents.governmentId
          ?.base64Data
      ) {
        missing.push(
          "government-issued ID",
        );
      }

      if (
        !documents
          .trainingCertificate
          ?.base64Data
      ) {
        missing.push(
          "training certificate",
        );
      }

      if (
        !approvedRole.trim()
      ) {
        missing.push(
          "approved responder role",
        );
      }

      if (
        !assignedBarangayId.trim()
      ) {
        missing.push(
          "assigned barangay",
        );
      }

      return {
        ready:
          !documentsLoading &&
          missing.length === 0,

        missing,
      };
    }, [
      approvedRole,
      assignedBarangayId,
      documents.governmentId
        ?.base64Data,
      documents
        .trainingCertificate
        ?.base64Data,
      documentsLoading,
    ]);

  if (!application) {
    return null;
  }

  const currentApplication =
    application;

  const profileSource =
    mobileProfileImageSource(
      documents.profilePhoto
        ?.base64Data,
    );

  const alreadyApproved =
    safeText(
      currentApplication.status,
    ).toLowerCase() ===
    "approved";

  const applicantName =
    safeText(
      currentApplication.fullName,
      "Respondent applicant",
    );

  /**
   * Saves one review decision.
   *
   * Returns true only when the Firebase operation
   * finishes successfully.
   */
  async function submitReview(
    nextStatus:
      RespondentApplicationStatus,
  ): Promise<boolean> {
    if (
      nextStatus === "approved" &&
      !approvalReadiness.ready
    ) {
      setError(
        "Approval is not ready. Complete: " +
          `${approvalReadiness.missing.join(
            ", ",
          )}.`,
      );

      return false;
    }

    const effectiveMessage =
      nextStatus === "approved" &&
      !reviewMessage.trim()
        ? DEFAULT_APPROVAL_MESSAGE
        : reviewMessage.trim();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result =
        await reviewRespondentApplication(
          {
            application:
              currentApplication,

            status:
              nextStatus,

            reviewMessage:
              effectiveMessage,

            approvedRole:
              approvedRole.trim(),

            assignedBarangayId:
              assignedBarangayId.trim(),

            serviceArea:
              serviceArea.trim(),
          },
        );

      setStatus(nextStatus);

      setReviewMessage(
        effectiveMessage,
      );

      if (
        nextStatus === "approved"
      ) {
        setSuccess(
          "Respondent approved and activated. " +
            `Android notification queued as ${result.notificationId}.`,
        );
      } else {
        setSuccess(
          "Application review saved. " +
            `Android notification queued as ${result.notificationId}.`,
        );
      }

      return true;
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to review the application.",
      );

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function approveRespondent(): Promise<void> {
    if (
      alreadyApproved ||
      saving
    ) {
      return;
    }

    if (
      !approvalReadiness.ready
    ) {
      setError(
        "Approval is not ready. Complete: " +
          `${approvalReadiness.missing.join(
            ", ",
          )}.`,
      );

      return;
    }

    const roleLabel =
      formatRole(
        approvedRole,
      );

    const confirmed =
      window.confirm(
        `Approve ${applicantName} as ${roleLabel}? ` +
          "This activates respondent access and " +
          "emergency assignment eligibility.",
      );

    if (!confirmed) {
      return;
    }

    const approved =
      await submitReview(
        "approved",
      );

    if (!approved) {
      return;
    }

    /*
     * The approval service has already written:
     *
     * /responderApplications/{uid}/status = approved
     * /respondents/{uid}
     * /users/{uid}/role = respondent
     * /emergencyDispatchRecipients/respondents/{uid}
     *
     * The parent page now closes this dialog,
     * filters the approved application from the
     * review list, and opens Registered respondents.
     */
    if (onApproved) {
      onApproved();
    } else {
      close();
    }
  }

  async function saveSelectedDecision(): Promise<void> {
    if (
      status === "approved"
    ) {
      await approveRespondent();
      return;
    }

    await submitReview(status);
  }

  return (
    <Dialog
      open={Boolean(application)}
      onClose={
        saving
          ? undefined
          : close
      }
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            p: 3,
            color: "white",
            background:
              "linear-gradient(135deg, #063F49 0%, #0B7F88 55%, #10A6A5 100%)",
            position: "relative",
          }}
        >
          <IconButton
            aria-label="Close"
            onClick={close}
            disabled={saving}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              color: "white",
              bgcolor: alpha(
                "#FFFFFF",
                0.1,
              ),
              "&:hover": {
                bgcolor: alpha(
                  "#FFFFFF",
                  0.18,
                ),
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
            spacing={2}
            alignItems={{
              sm: "center",
            }}
          >
            <Avatar
              src={
                profileSource
              }
              sx={{
                width: 82,
                height: 82,
                border:
                  "3px solid white",
                bgcolor:
                  alpha(
                    "#FFFFFF",
                    0.18,
                  ),
                color: "white",
                fontWeight: 900,
                fontSize: 28,
              }}
            >
              {applicantName
                .slice(0, 1)
                .toUpperCase()}
            </Avatar>

            <Box>
              <Chip
                size="small"
                label={
                  formatStatus(
                    currentApplication.status,
                  )
                }
                sx={{
                  bgcolor:
                    alpha(
                      "#FFFFFF",
                      0.16,
                    ),
                  color: "white",
                  fontWeight: 900,
                }}
              />

              <Typography
                variant="h4"
                sx={{
                  mt: 0.7,
                }}
              >
                {applicantName}
              </Typography>

              <Typography
                sx={{
                  color: alpha(
                    "#FFFFFF",
                    0.8,
                  ),
                }}
              >
                {safeText(
                  currentApplication.email,
                  "No email",
                )}
                {" · "}
                {safeText(
                  currentApplication.phone,
                  "No phone",
                )}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
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

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.25,
            }}
          >
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                >
                  <PersonOutlined color="primary" />

                  <Box>
                    <Typography fontWeight={800}>
                      Applicant details
                    </Typography>

                    <Typography
                      fontSize={13}
                      color="text.secondary"
                    >
                      {safeText(
                        currentApplication.birthDate,
                        "Birth date not supplied",
                      )}
                      {" · "}
                      {safeText(
                        currentApplication.gender,
                        "Gender not supplied",
                      )}

                      <br />

                      {safeText(
                        currentApplication.address,
                        "Address not supplied",
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                >
                  <HowToRegOutlined color="primary" />

                  <Box>
                    <Typography fontWeight={800}>
                      Requested role
                    </Typography>

                    <Typography
                      fontSize={13}
                      color="text.secondary"
                    >
                      {formatRole(
                        currentApplication.requestedRole,
                      )}

                      <br />

                      {safeText(
                        currentApplication.organization,
                        "Independent applicant",
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  spacing={1}
                >
                  <VerifiedOutlined color="primary" />

                  <Box>
                    <Typography fontWeight={800}>
                      Training summary
                    </Typography>

                    <Typography
                      fontSize={13}
                      color="text.secondary"
                    >
                      {safeText(
                        currentApplication.trainingSummary,
                        "Not recorded",
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {documentsLoading && (
            <Alert
              severity="info"
              icon={
                <CircularProgress
                  size={18}
                />
              }
            >
              Loading identity and
              training evidence…
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <DocumentPreview
              title="Government-issued ID"
              icon={
                <BadgeOutlined color="primary" />
              }
              base64Data={
                documents.governmentId
                  ?.base64Data
              }
            />

            <DocumentPreview
              title="Training certificate"
              icon={
                <ArticleOutlined color="primary" />
              }
              base64Data={
                documents
                  .trainingCertificate
                  ?.base64Data
              }
            />
          </Box>

          <Divider />

          <Stack spacing={1.25}>
            <Typography variant="h6">
              Administrator review
            </Typography>

            {alreadyApproved ? (
              <Alert
                severity="success"
                icon={
                  <CheckCircleRounded />
                }
              >
                This respondent is
                already approved and
                active.
              </Alert>
            ) : approvalReadiness.ready ? (
              <Alert
                severity="success"
                icon={
                  <CheckCircleRounded />
                }
              >
                Identity evidence,
                training evidence,
                role, and barangay are
                complete. The
                application is ready
                for final approval.
              </Alert>
            ) : (
              <Alert
                severity="warning"
                icon={
                  <WarningAmberRounded />
                }
              >
                Complete before
                approval:{" "}
                {approvalReadiness
                  .missing
                  .join(", ")}
                .
              </Alert>
            )}

            <Stack
              direction={{
                xs: "column",
                md: "row",
              }}
              spacing={1.5}
            >
              <TextField
                select
                fullWidth
                label="Review decision"
                value={status}
                disabled={
                  saving ||
                  alreadyApproved
                }
                onChange={(event) => {
                  const nextStatus =
                    event.target
                      .value as RespondentApplicationStatus;

                  setStatus(
                    nextStatus,
                  );

                  setError("");
                  setSuccess("");

                  if (
                    nextStatus ===
                      "approved" &&
                    !reviewMessage.trim()
                  ) {
                    setReviewMessage(
                      DEFAULT_APPROVAL_MESSAGE,
                    );
                  }
                }}
              >
                {REVIEW_STATUSES.map(
                  (item) => (
                    <MenuItem
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </MenuItem>
                  ),
                )}
              </TextField>

              <TextField
                fullWidth
                label="Approved role"
                value={approvedRole}
                disabled={
                  saving ||
                  alreadyApproved
                }
                required
                onChange={(event) => {
                  setApprovedRole(
                    event.target.value,
                  );
                  setError("");
                  setSuccess("");
                }}
              />

              <TextField
                select
                fullWidth
                label="Assigned barangay"
                value={
                  assignedBarangayId
                }
                disabled={
                  saving ||
                  alreadyApproved
                }
                required
                onChange={(event) => {
                  setAssignedBarangayId(
                    event.target.value,
                  );
                  setError("");
                  setSuccess("");
                }}
              >
                {barangays.map(
                  (barangay) => (
                    <MenuItem
                      key={barangay.id}
                      value={barangay.id}
                    >
                      {barangay.name}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </Stack>

            <TextField
              label="Service area"
              value={serviceArea}
              disabled={
                saving ||
                alreadyApproved
              }
              onChange={(event) => {
                setServiceArea(
                  event.target.value,
                );
                setError("");
                setSuccess("");
              }}
            />

            <TextField
              multiline
              minRows={3}
              label="Administrator message to applicant"
              value={reviewMessage}
              disabled={
                saving ||
                alreadyApproved
              }
              onChange={(event) => {
                setReviewMessage(
                  event.target.value,
                );
                setError("");
                setSuccess("");
              }}
              helperText={
                "This message appears on the applicant status screen " +
                "and is sent to the Android notification inbox."
              }
            />
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2.25,
          borderTop: "1px solid",
          borderColor: "divider",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Button
          onClick={close}
          disabled={saving}
        >
          Close
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {!alreadyApproved && (
          <Button
            variant="outlined"
            startIcon={
              saving
                ? undefined
                : <SaveRounded />
            }
            onClick={
              saveSelectedDecision
            }
            disabled={saving}
          >
            Save selected decision
          </Button>
        )}

        <Button
          variant="contained"
          color="success"
          startIcon={
            saving
              ? undefined
              : (
                <CheckCircleRounded />
              )
          }
          onClick={
            approveRespondent
          }
          disabled={
            saving ||
            alreadyApproved ||
            !approvalReadiness.ready
          }
        >
          {saving ? (
            <CircularProgress
              size={20}
              color="inherit"
            />
          ) : alreadyApproved ? (
            "Respondent approved"
          ) : (
            "Approve and activate respondent"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}