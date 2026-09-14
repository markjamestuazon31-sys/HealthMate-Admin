import {
  AssignmentIndOutlined,
  GroupsOutlined,
  HistoryOutlined,
} from "@mui/icons-material";
import { Chip, Stack, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import ApplicationReviewDialog from "../components/responders/ApplicationReviewDialog";
import ApplicationTable from "../components/responders/ApplicationTable";
import InvitationTable from "../components/responders/InvitationTable";
import ResponderTable from "../components/responders/ResponderTable";
import { listenRespondentApplications } from "../services/respondentApplicationService";
import { listenRespondentInvitations, listenResponders } from "../services/respondentInvitationService";
import type { RespondentApplication, RespondentInvitation, Responder } from "../types";

export default function Responders() {
  const [tab, setTab] = useState(0);
  const [applications, setApplications] = useState<RespondentApplication[]>([]);
  const [invitations, setInvitations] = useState<RespondentInvitation[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<RespondentApplication | null>(null);

  useEffect(() => listenRespondentApplications(setApplications), []);
  useEffect(() => listenRespondentInvitations(setInvitations), []);
  useEffect(() => listenResponders(setResponders), []);

  const pendingCount = applications.filter((item) => [
    "pending_review",
    "under_verification",
    "additional_documents_required",
  ].includes(item.status)).length;

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Verified emergency personnel"
        title="Responders operations"
        description="Review mobile respondent applications, verify identity and training evidence, activate qualified personnel, and manage existing respondent accounts."
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Chip icon={<AssignmentIndOutlined />} label={`${pendingCount} applications require review`} color={pendingCount ? "warning" : "success"} variant="outlined" />
        <Chip icon={<GroupsOutlined />} label={`${responders.filter((item) => item.accountStatus === "active").length} active respondents`} color="success" variant="outlined" />
        <Chip icon={<HistoryOutlined />} label={`${invitations.length} legacy account records`} color="info" variant="outlined" />
      </Stack>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Applications" />
        <Tab label="Registered respondents" />
        <Tab label="Legacy account records" />
      </Tabs>

      {tab === 0 && <ApplicationTable applications={applications} openApplication={setSelectedApplication} />}
      {tab === 1 && <ResponderTable responders={responders} />}
      {tab === 2 && <InvitationTable invitations={invitations} />}

      <ApplicationReviewDialog application={selectedApplication} close={() => setSelectedApplication(null)} />
    </Stack>
  );
}
