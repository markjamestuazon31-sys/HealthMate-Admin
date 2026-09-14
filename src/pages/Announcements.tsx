import { AddOutlined } from "@mui/icons-material";
import { Button, Dialog, Stack } from "@mui/material";
import { useEffect, useState } from "react";

import AnnouncementForm from "../components/announcements/AnnouncementForm";
import AnnouncementTable from "../components/announcements/AnnouncementTable";
import PageHeader from "../components/common/PageHeader";
import { listenAnnouncements } from "../services/announcementService";
import type { Announcement } from "../types";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = listenAnnouncements(setAnnouncements);

    return unsubscribe;
  }, []);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Announcements"
        description="Publish health advisories and community updates for connected users."
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setOpen(true)}
          >
            Create announcement
          </Button>
        }
      />

      <AnnouncementTable data={announcements} />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <AnnouncementForm close={() => setOpen(false)} />
      </Dialog>
    </Stack>
  );
}