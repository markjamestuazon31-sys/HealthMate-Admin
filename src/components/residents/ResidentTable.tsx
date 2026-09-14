import { ArrowForwardOutlined } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { User } from "../../types";
import { mobileProfileImageSource } from "../../utils/imageData";

export default function ResidentTable({
  users,
  onView,
}: {
  users: User[];
  onView: (user: User) => void;
}) {
  return (
    <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>Resident</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 7 }}>
                <Typography fontWeight={750}>No residents found</Typography>
                <Typography color="text.secondary" fontSize={13} sx={{ mt: 0.5 }}>
                  Adjust the search term or wait for mobile registrations.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.uid} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar src={mobileProfileImageSource(user.profileImage) || undefined} sx={{ width: 42, height: 42, bgcolor: "primary.main", fontWeight: 850 }}>
                      {(user.fullName?.[0] ?? "R").toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={750}>{user.fullName}</Typography>
                      <Typography color="text.secondary" fontSize={12}>
                        {user.email || "No email supplied"}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.contactNumber || user.phone || "—"}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>{user.address || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={user.status || "Active"}
                    color={user.status === "inactive" ? "default" : "success"}
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    endIcon={<ArrowForwardOutlined />}
                    onClick={() => onView(user)}
                  >
                    View profile
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
