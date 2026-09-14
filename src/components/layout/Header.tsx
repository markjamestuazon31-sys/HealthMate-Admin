import {
  ChevronRightRounded,
  LogoutOutlined,
  MenuRounded,
  NotificationsNoneRounded,
  SearchRounded,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../firebase/auth";
import { profileImageSource } from "../../utils/imageData";
import { drawerWidth } from "./Sidebar";

const searchableDestinations = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Emergencies", path: "/emergencies" },
  { label: "Live response map", path: "/map" },
  { label: "Residents", path: "/residents" },
  { label: "Respondent authorization", path: "/responders" },
  { label: "Emergency directory", path: "/directory" },
  { label: "Monitoring reports", path: "/monitoring-reports" },
  { label: "Inhabitants profiling", path: "/inhabitants" },
  { label: "Rescue reports", path: "/rescue-reports" },
  { label: "Announcements", path: "/announcements" },
  { label: "Reports center", path: "/reports" },
  { label: "Audit logs", path: "/audit" },
  { label: "Administrator profile", path: "/profile" },
] as const;

function initials(name: string, email: string) {
  const parts = (name.trim() || email.trim() || "A").split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, role, adminProfile } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const displayName =
    adminProfile?.fullName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "Administrator";

  const displayEmail = adminProfile?.email || user?.email || "";
  const displayTitle = adminProfile?.officeTitle?.trim() || "Portal Administrator";
  const avatarSource = profileImageSource(
    adminProfile?.profileImageData,
    adminProfile?.profileImageMimeType,
  );
  const avatarText = useMemo(() => initials(displayName, displayEmail), [displayName, displayEmail]);

  function submitSearch() {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return;

    const destination = searchableDestinations.find((item) =>
      item.label.toLowerCase().includes(normalizedQuery),
    );

    if (destination) {
      navigate(destination.path);
      setQuery("");
    }
  }

  async function handleLogout() {
    await logoutUser();
    navigate("/", { replace: true });
  }

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        ml: { md: `${drawerWidth}px` },
        width: { md: `calc(100% - ${drawerWidth}px)` },
        bgcolor: alpha("#FFFFFF", 0.96),
        color: "text.primary",
        borderBottom: `1px solid ${alpha("#B42318", 0.09)}`,
        backdropFilter: "blur(14px)",
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 68, md: 76 },
          px: { xs: 1.5, sm: 2.5, md: 3 },
        }}
      >
        <IconButton
          onClick={onMenuClick}
          edge="start"
          sx={{ mr: 1, display: { md: "none" } }}
          aria-label="Open navigation"
        >
          <MenuRounded />
        </IconButton>

        <TextField
          inputRef={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch();

            if (event.key === "Escape") {
              setQuery("");
              searchInputRef.current?.blur();
            }
          }}
          placeholder="Search portal pages"
          aria-label="Search HealthMate portal pages"
          sx={{
            display: { xs: "none", sm: "block" },
            width: { sm: 360, lg: 430 },
            "& .MuiOutlinedInput-root": {
              minHeight: 44,
              borderRadius: 3,
              bgcolor: "#FFFFFF",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Box
                  sx={{
                    display: { xs: "none", md: "block" },
                    px: 1,
                    py: 0.35,
                    borderRadius: 1.5,
                    bgcolor: alpha("#B42318", 0.04),
                    border: `1px solid ${alpha("#B42318", 0.08)}`,
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  Ctrl K
                </Box>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }}>
          <Tooltip title="Announcements">
            <IconButton onClick={() => navigate("/announcements")} aria-label="Open announcements">
              <NotificationsNoneRounded />
            </IconButton>
          </Tooltip>

          <ButtonBase
            onClick={() => navigate("/profile")}
            aria-label="Open administrator profile"
            sx={{
              minWidth: 0,
              borderRadius: 999,
              px: { xs: 0.5, sm: 1 },
              py: 0.5,
              textAlign: "left",
              border: `1px solid ${alpha("#B42318", 0.08)}`,
              bgcolor: alpha("#FFF1F0", 0.95),
              "&:hover": {
                bgcolor: alpha("#FDECEA", 1),
              },
            }}
          >
            <Avatar
              src={avatarSource || undefined}
              alt={displayName}
              sx={{
                width: 42,
                height: 42,
                bgcolor: "primary.main",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {avatarText}
            </Avatar>

            <Box
              sx={{
                display: { xs: "none", md: "block" },
                ml: 1.25,
                minWidth: 0,
                maxWidth: 205,
              }}
            >
              <Typography fontWeight={850} fontSize={14} noWrap>
                {displayName}
              </Typography>
              <Typography color="text.secondary" fontSize={11.5} noWrap>
                {displayTitle} · {role ?? "admin"}
              </Typography>
            </Box>

            <ChevronRightRounded
              sx={{
                display: { xs: "none", sm: "block" },
                ml: 0.5,
                color: "text.secondary",
                fontSize: 19,
              }}
            />
          </ButtonBase>

          <Tooltip title="Sign out">
            <IconButton onClick={handleLogout} aria-label="Sign out">
              <LogoutOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}