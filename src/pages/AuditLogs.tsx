import { Stack } from "@mui/material";
import { useEffect, useState } from "react";
import AuditTable from "../components/audit/AuditTable";
import PageHeader from "../components/common/PageHeader";
import { listenAuditLogs } from "../services/auditService";
import type { AuditLog } from "../types";

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => listenAuditLogs(setLogs), []);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Audit logs"
        description="Review recorded administrative actions and access-related events."
      />
      <AuditTable logs={logs} />
    </Stack>
  );
}
