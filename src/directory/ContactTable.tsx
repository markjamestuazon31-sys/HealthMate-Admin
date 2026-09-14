import {
  DeleteOutlineRounded,
  EditRounded,
  LocalPhoneRounded,
  MailOutlineRounded,
  PlaceOutlined,
  PowerSettingsNewRounded,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import type { EmergencyDirectoryContact } from "../types";

function categoryLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContactTable({
  contacts,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  contacts: EmergencyDirectoryContact[];
  onEdit: (contact: EmergencyDirectoryContact) => void;
  onToggleActive: (contact: EmergencyDirectoryContact) => void;
  onDelete: (contact: EmergencyDirectoryContact) => void;
}) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        borderRadius: 2.75,
        borderColor: "rgba(180,35,24,.12)",
        overflowX: "auto",
      }}
    >
      <Table sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                bgcolor: "rgba(180,35,24,.035)",
                color: "text.secondary",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.35,
                textTransform: "uppercase",
              },
            }}
          >
            <TableCell>Emergency service</TableCell>
            <TableCell>Contact numbers</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Location / email</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              hover
              sx={{
                "&:last-child td": { borderBottom: 0 },
                opacity: contact.active ? 1 : 0.65,
              }}
            >
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: "rgba(180,35,24,.09)",
                      color: "primary.main",
                    }}
                  >
                    <LocalPhoneRounded fontSize="small" />
                  </Avatar>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={900} noWrap>
                      {contact.shortName}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      fontSize={12.5}
                      sx={{ mt: 0.25 }}
                    >
                      {contact.organizationName}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>

              <TableCell>
                <Typography fontWeight={850}>{contact.phone}</Typography>
                {contact.alternatePhone && (
                  <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.3 }}>
                    Alt: {contact.alternatePhone}
                  </Typography>
                )}
              </TableCell>

              <TableCell>
                <Chip
                  size="small"
                  label={categoryLabel(contact.category)}
                  variant="outlined"
                  sx={{
                    fontWeight: 750,
                    borderColor: "rgba(180,35,24,.16)",
                    bgcolor: "rgba(180,35,24,.035)",
                  }}
                />
              </TableCell>

              <TableCell>
                <Stack spacing={0.45}>
                  <Stack direction="row" spacing={0.6} alignItems="center">
                    <PlaceOutlined sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography fontSize={12.5}>
                      {contact.address || "No address recorded"}
                    </Typography>
                  </Stack>

                  {contact.email && (
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <MailOutlineRounded
                        sx={{ fontSize: 15, color: "text.secondary" }}
                      />
                      <Typography color="text.secondary" fontSize={12}>
                        {contact.email}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </TableCell>

              <TableCell>
                <Chip
                  size="small"
                  label={contact.active ? "ACTIVE" : "INACTIVE"}
                  color={contact.active ? "success" : "default"}
                  variant={contact.active ? "filled" : "outlined"}
                  sx={{ fontWeight: 850 }}
                />
              </TableCell>

              <TableCell align="right">
                <Stack
                  direction="row"
                  spacing={0.25}
                  justifyContent="flex-end"
                >
                  <Tooltip title="Edit hotline">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => onEdit(contact)}
                      aria-label={`Edit ${contact.shortName}`}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip
                    title={contact.active ? "Deactivate hotline" : "Activate hotline"}
                  >
                    <IconButton
                      size="small"
                      color={contact.active ? "warning" : "success"}
                      onClick={() => onToggleActive(contact)}
                      aria-label={
                        contact.active
                          ? `Deactivate ${contact.shortName}`
                          : `Activate ${contact.shortName}`
                      }
                    >
                      <PowerSettingsNewRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete hotline">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(contact)}
                      aria-label={`Delete ${contact.shortName}`}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ))}

          {contacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    mx: "auto",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: "rgba(180,35,24,.08)",
                  }}
                >
                  <LocalPhoneRounded />
                </Box>
                <Typography fontWeight={900} sx={{ mt: 1.5 }}>
                  No emergency lines configured
                </Typography>
                <Typography
                  color="text.secondary"
                  fontSize={13}
                  sx={{ mt: 0.5, maxWidth: 430, mx: "auto" }}
                >
                  Add an active hotline so the Respondent app can display a
                  callable emergency directory.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
