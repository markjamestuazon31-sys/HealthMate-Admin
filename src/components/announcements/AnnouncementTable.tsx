import { DeleteOutline, ImageOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { deleteAnnouncement } from "../../services/announcementService";
import type { Announcement } from "../../types";
import { announcementImageSource } from "../../utils/imageData";

export default function AnnouncementTable({ data }: { data: Announcement[] }) {
  async function remove(item: Announcement) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    await deleteAnnouncement(item.id);
  }

  return (
    <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            <TableCell>Announcement</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Published</TableCell>
            <TableCell>Expires</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 7 }}>
                <Typography fontWeight={750}>No announcements published</Typography>
                <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                  Create a health or safety advisory for HealthMate mobile users.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => {
              const expired = item.expiresAt > 0 && item.expiresAt <= Date.now();
              const imageSource = announcementImageSource(item.imageData, item.imageMimeType);
              return (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ maxWidth: 470 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {imageSource ? (
                        <Box
                          component="img"
                          src={imageSource}
                          alt=""
                          sx={{ width: 76, height: 56, borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 76,
                            height: 56,
                            borderRadius: 2,
                            bgcolor: "action.hover",
                            display: "grid",
                            placeItems: "center",
                            color: "text.disabled",
                            flexShrink: 0,
                          }}
                        >
                          <ImageOutlined />
                        </Box>
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={750}>{item.title}</Typography>
                        <Typography color="text.secondary" fontSize={12} noWrap>
                          {item.content}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Chip label={item.category} size="small" variant="outlined" />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={expired ? "Expired" : item.status}
                      size="small"
                      color={expired ? "default" : item.status === "published" ? "success" : "warning"}
                    />
                  </TableCell>

                  <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</TableCell>
                  <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "No expiry"}</TableCell>

                  <TableCell align="right">
                    <Button
                      color="error"
                      size="small"
                      startIcon={<DeleteOutline />}
                      onClick={() => remove(item)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
