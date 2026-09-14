import {
  AddRounded,
  CheckCircleRounded,
  EmergencyRounded,
  LocalHospitalRounded,
  PhoneInTalkRounded,
  PublicRounded,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import PageHeader from "../components/common/PageHeader";
import ContactFormDialog from "../directory/ContactFormDialog";
import ContactTable from "../directory/ContactTable";
import {
  deleteDirectoryContact,
  ensureBunuananDirectory,
  listenBunuananContacts,
  listenGlobalContacts,
  setDirectoryContactActive,
  type DirectoryScope,
} from "../services/directoryService";
import { seedCatbaloganHotlines } from "../services/hotlineSeedService";
import {
  BUNUANAN_BARANGAY_ID,
  BUNUANAN_BARANGAY_NAME,
  BUNUANAN_CITY,
} from "../config/bunuananServiceArea";
import type { EmergencyDirectoryContact } from "../types";

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.25,
        borderRadius: 3,
        borderColor: "rgba(180,35,24,.14)",
        boxShadow: "0 10px 28px rgba(38,27,25,.05)",
        minHeight: 132,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            bgcolor: "rgba(180,35,24,.08)",
            flex: "0 0 auto",
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 900, letterSpacing: 0.9, lineHeight: 1.1 }}
          >
            {label}
          </Typography>
          <Typography
            variant="h4"
            sx={{ mt: 0.35, fontWeight: 900, letterSpacing: -0.6 }}
          >
            {value}
          </Typography>
          <Typography color="text.secondary" fontSize={12.5} sx={{ mt: 0.5 }}>
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function EmergencyDirectory() {
  const [tab, setTab] = useState(0);
  const [localContacts, setLocalContacts] = useState<
    EmergencyDirectoryContact[]
  >([]);
  const [globalContacts, setGlobalContacts] = useState<
    EmergencyDirectoryContact[]
  >([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<EmergencyDirectoryContact | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeCanonicalDirectory() {
      try {
        const result = await ensureBunuananDirectory();
        if (!mounted) return;

        if (result.migratedContacts > 0) {
          setMessage(
            `${result.migratedContacts} legacy Bunuanan hotline${
              result.migratedContacts === 1 ? "" : "s"
            } were synchronized to the canonical Respondent directory.`,
          );
        }
      } catch (caught: unknown) {
        if (!mounted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to initialize the Bunuanan emergency directory.",
        );
      }
    }

    void initializeCanonicalDirectory();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = listenBunuananContacts(setLocalContacts);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);

  useEffect(() => {
    const unsubscribe = listenGlobalContacts(setGlobalContacts);
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, []);

  const scope: DirectoryScope = tab === 0 ? "barangay" : "global";
  const visibleContacts = scope === "barangay" ? localContacts : globalContacts;
  const directoryBarangayId =
    scope === "barangay" ? BUNUANAN_BARANGAY_ID : undefined;

  const localActive = useMemo(
    () => localContacts.filter((item) => item.active).length,
    [localContacts],
  );
  const globalActive = useMemo(
    () => globalContacts.filter((item) => item.active).length,
    [globalContacts],
  );
  const respondentVisible = localActive + globalActive;
  const directoryReady = respondentVisible > 0;

  function clearFeedback(): void {
    setMessage("");
    setError("");
  }

  function openNewContact(): void {
    clearFeedback();
    setEditingContact(null);
    setContactOpen(true);
  }

  function openEditContact(contact: EmergencyDirectoryContact): void {
    clearFeedback();
    setEditingContact(contact);
    setContactOpen(true);
  }

  function closeContactDialog(): void {
    setContactOpen(false);
    setEditingContact(null);
  }

  async function runAction(
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<void> {
    setBusy(true);
    clearFeedback();

    try {
      await action();
      setMessage(successMessage);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The emergency-directory operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function repairDirectory(): Promise<void> {
    setRepairing(true);
    clearFeedback();

    try {
      const result = await ensureBunuananDirectory();
      setMessage(
        result.migratedContacts > 0
          ? `${result.migratedContacts} legacy Bunuanan hotline${
              result.migratedContacts === 1 ? "" : "s"
            } synchronized successfully.`
          : "Bunuanan directory is already synchronized with the Respondent app.",
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to synchronize the Bunuanan directory.",
      );
    } finally {
      setRepairing(false);
    }
  }

  async function importSeed(): Promise<void> {
    await runAction(
      seedCatbaloganHotlines,
      "Catbalogan general emergency hotlines were imported successfully.",
    );
  }

  async function toggleContact(
    contact: EmergencyDirectoryContact,
  ): Promise<void> {
    await runAction(
      () =>
        setDirectoryContactActive(
          scope,
          contact,
          !contact.active,
          directoryBarangayId,
        ),
      `${contact.shortName} is now ${contact.active ? "inactive" : "active"}.`,
    );
  }

  async function removeContact(
    contact: EmergencyDirectoryContact,
  ): Promise<void> {
    const confirmed = window.confirm(
      `Delete ${contact.shortName} from the emergency directory?`,
    );

    if (!confirmed) return;

    await runAction(
      () => deleteDirectoryContact(scope, contact, directoryBarangayId),
      `${contact.shortName} was deleted.`,
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Emergency response infrastructure"
        title="Emergency Directory"
        description={`Manage the hotline directory used by HealthMate Respondents. Local records are fixed to ${BUNUANAN_BARANGAY_NAME}, ${BUNUANAN_CITY}, while general hotlines provide a citywide fallback.`}
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<SyncRounded />}
              onClick={() => void repairDirectory()}
              disabled={busy || repairing}
            >
              {repairing ? "Synchronizing…" : "Repair / sync"}
            </Button>

            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={openNewContact}
              disabled={busy}
            >
              Add {scope === "barangay" ? "Bunuanan contact" : "general hotline"}
            </Button>
          </Stack>
        }
      />

      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <MetricCard
          icon={<LocalHospitalRounded />}
          label="Bunuanan active"
          value={localActive}
          helper="Local barangay emergency lines"
        />
        <MetricCard
          icon={<PublicRounded />}
          label="General active"
          value={globalActive}
          helper="Catbalogan-wide fallback hotlines"
        />
        <MetricCard
          icon={<PhoneInTalkRounded />}
          label="Respondent-visible"
          value={respondentVisible}
          helper="Active lines currently available to the Android directory"
        />
        <MetricCard
          icon={
            directoryReady ? (
              <CheckCircleRounded />
            ) : (
              <WarningAmberRounded />
            )
          }
          label="Directory status"
          value={directoryReady ? "Ready" : "Needs line"}
          helper={
            directoryReady
              ? "At least one active hotline is published"
              : "Publish a local or general emergency line"
          }
        />
      </Box>

      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3.5,
          overflow: "hidden",
          borderColor: "rgba(180,35,24,.14)",
          boxShadow: "0 14px 36px rgba(38,27,25,.05)",
        }}
      >
        <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2.25 }}>
          <Tabs
            value={tab}
            onChange={(_event, value: number) => {
              setTab(value);
              closeContactDialog();
              clearFeedback();
            }}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            <Tab label={`Bunuanan local (${localContacts.length})`} />
            <Tab label={`General hotlines (${globalContacts.length})`} />
          </Tabs>
        </Box>

        <Box
          sx={{
            borderTop: 1,
            borderColor: "divider",
            p: { xs: 2, md: 2.5 },
          }}
        >
          {scope === "barangay" ? (
            <Stack spacing={2.25}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  bgcolor: "rgba(180,35,24,.035)",
                  borderColor: "rgba(180,35,24,.14)",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        color: "primary.main",
                        bgcolor: "rgba(180,35,24,.09)",
                      }}
                    >
                      <EmergencyRounded />
                    </Box>
                    <Box>
                      <Typography fontWeight={900}>
                        {BUNUANAN_BARANGAY_NAME} responder directory
                      </Typography>
                      <Typography color="text.secondary" fontSize={12.5}>
                        Canonical service area used by Resident, Respondent, SOS,
                        Heatmap, and Inhabitants Profiling.
                      </Typography>
                    </Box>
                  </Stack>

                  <Chip
                    icon={
                      localActive > 0 ? (
                        <CheckCircleRounded />
                      ) : (
                        <WarningAmberRounded />
                      )
                    }
                    label={
                      localActive > 0
                        ? "RESPONDENT SYNC READY"
                        : "NO ACTIVE LOCAL LINE"
                    }
                    color={localActive > 0 ? "success" : "warning"}
                    variant="outlined"
                    sx={{ fontWeight: 850 }}
                  />
                </Stack>
              </Paper>

              {localActive === 0 && (
                <Alert severity="warning">
                  Bunuanan has no active local hotline. Respondents can still use
                  active general hotlines, but at least one local contact is
                  recommended.
                </Alert>
              )}

              <ContactTable
                contacts={visibleContacts}
                onEdit={openEditContact}
                onToggleActive={toggleContact}
                onDelete={removeContact}
              />
            </Stack>
          ) : (
            <Stack spacing={2.25}>
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void importSeed()}
                    disabled={busy}
                  >
                    Import approved list
                  </Button>
                }
              >
                General hotlines are shown to Respondents as fallback contacts in
                addition to active Bunuanan local lines.
              </Alert>

              <ContactTable
                contacts={visibleContacts}
                onEdit={openEditContact}
                onToggleActive={toggleContact}
                onDelete={removeContact}
              />
            </Stack>
          )}
        </Box>
      </Paper>

      <ContactFormDialog
        open={contactOpen}
        scope={scope}
        barangayId={directoryBarangayId}
        contact={editingContact}
        onClose={closeContactDialog}
      />
    </Stack>
  );
}
