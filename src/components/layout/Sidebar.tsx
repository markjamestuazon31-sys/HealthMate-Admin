import {
  AssessmentOutlined,
  FactCheckOutlined,
  CampaignOutlined,
  ChevronRightRounded,
  DashboardOutlined,
  DescriptionOutlined,
  HistoryOutlined,
  LocalHospitalOutlined,
  MapOutlined,
  PeopleAltOutlined,
  HomeWorkOutlined,
  WhatshotOutlined,
  SupportAgentOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  ButtonBase,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import healthMateLogo from "../../assets/healthmate-logo.png";
import { useAuth } from "../../context/AuthContext";
import { profileImageSource } from "../../utils/imageData";

export const drawerWidth = 288;

const menuSections = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", path: "/dashboard", icon: <DashboardOutlined /> },
    ],
  },
  {
    label: "Emergency operations",
    items: [
      { title: "Emergencies", path: "/emergencies", icon: <WarningAmberOutlined /> },
      { title: "Live response map", path: "/map", icon: <MapOutlined /> },
      { title: "Incident heatmap", path: "/incident-heatmap", icon: <WhatshotOutlined /> },
    ],
  },
  {
    label: "People & coordination",
    items: [
      { title: "Residents", path: "/residents", icon: <PeopleAltOutlined /> },
      { title: "Inhabitants profiling", path: "/inhabitants", icon: <HomeWorkOutlined /> },
      { title: "Respondent authorization", path: "/responders", icon: <SupportAgentOutlined /> },
      { title: "Emergency directory", path: "/directory", icon: <LocalHospitalOutlined /> },
    ],
  },
  {
    label: "Communication & records",
    items: [
      { title: "Monitoring reports", path: "/monitoring-reports", icon: <FactCheckOutlined /> },
      { title: "Rescue reports", path: "/rescue-reports", icon: <DescriptionOutlined /> },
      { title: "Announcements", path: "/announcements", icon: <CampaignOutlined /> },
      { title: "Analytics", path: "/reports", icon: <AssessmentOutlined /> },
      { title: "Audit logs", path: "/audit", icon: <HistoryOutlined /> },
    ],
  },
] as const;

function initials(name: string, email: string) {
  const value = name.trim() || email.trim() || "A";
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, adminProfile } = useAuth();

  const displayName =
    adminProfile?.fullName?.trim() || user?.displayName?.trim() || user?.email?.split("@")[0] || "Administrator";
  const displayEmail = adminProfile?.email || user?.email || "";
  const avatarSource = profileImageSource(
    adminProfile?.profileImageData,
    adminProfile?.profileImageMimeType,
  );

  const content = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#FFFFFF",
        background: "linear-gradient(180deg, #7A271A 0%, #B42318 55%, #D92D20 100%)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.55}
        sx={{
          px: 2.25,
          pt: 2.15,
          pb: 1.95,
          borderBottom: `1px solid ${alpha("#FFFFFF", 0.1)}`,
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: 54,
            height: 54,
            overflow: "hidden",
            flexShrink: 0,
            borderRadius: 3,
            bgcolor: "#FFFFFF",
            border: `2px solid ${alpha("#FFFFFF", 0.76)}`,
            boxShadow: `0 9px 24px ${alpha("#5E2016", 0.3)}, 0 0 0 4px ${alpha("#FFFFFF", 0.08)}`,
          }}
        >
          <Box
            component="img"
            src={healthMateLogo}
            alt="HealthMate"
            sx={{
              position: "absolute",
              top: -6,
              left: "50%",
              width: 86,
              height: 86,
              maxWidth: "none",
              objectFit: "cover",
              transform: "translateX(-50%)",
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography color="white" fontWeight={900} fontSize={17.5} lineHeight={1.12} noWrap>
            HealthMate Admin
          </Typography>
          <Typography
            sx={{
              color: alpha("#FFFFFF", 0.65),
              fontSize: 9.75,
              mt: 0.45,
              fontWeight: 780,
              letterSpacing: 0.68,
              textTransform: "uppercase",
            }}
            noWrap
          >
            Emergency command center
          </Typography>
        </Box>
      </Stack>

      <Box
        component="nav"
        aria-label="Administrator navigation"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          py: 1.5,
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: alpha("#FFFFFF", 0.17),
            borderRadius: 999,
          },
        }}
      >
        {menuSections.map((section, sectionIndex) => (
          <Box key={section.label} sx={{ mb: sectionIndex === menuSections.length - 1 ? 0 : 1.25 }}>
            <Typography
              component="div"
              sx={{
                px: 1.4,
                mb: 0.6,
                color: alpha("#FFFFFF", 0.46),
                fontSize: 9.75,
                lineHeight: 1.4,
                fontWeight: 850,
                letterSpacing: 0.9,
                textTransform: "uppercase",
              }}
            >
              {section.label}
            </Typography>

            <List disablePadding>
              {section.items.map((item) => {
                const selected =
                  location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

                return (
                  <ListItemButton
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    selected={selected}
                    onClick={onClose}
                    aria-current={selected ? "page" : undefined}
                    sx={{
                      position: "relative",
                      mb: 0.35,
                      minHeight: 43,
                      px: 1,
                      py: 0.55,
                      borderRadius: 2.25,
                      color: alpha("#FFFFFF", selected ? 1 : 0.82),
                      transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                      "&.Mui-selected": {
                        bgcolor: alpha("#FFFFFF", 0.18),
                        color: "#FFFFFF",
                        boxShadow: `inset 3px 0 0 ${alpha("#FFFFFF", 0.92)}, 0 8px 22px rgba(94,32,22,0.18)`,
                        "&:hover": { bgcolor: alpha("#FFFFFF", 0.22) },
                      },
                      "&:hover": {
                        bgcolor: alpha("#FFFFFF", 0.09),
                        color: "#FFFFFF",
                        transform: "translateX(2px)",
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${alpha("#FFFFFF", 0.9)}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 38,
                        color: "inherit",
                      }}
                    >
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 1.8,
                          bgcolor: selected ? alpha("#FFFFFF", 0.17) : alpha("#FFFFFF", 0.07),
                          "& .MuiSvgIcon-root": { fontSize: 19 },
                        }}
                      >
                        {item.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontWeight: selected ? 830 : 650,
                        fontSize: 13,
                        lineHeight: 1.25,
                        noWrap: true,
                      }}
                    />
                    {selected && (
                      <Box
                        aria-hidden
                        sx={{
                          width: 5,
                          height: 5,
                          ml: 0.5,
                          mr: 0.25,
                          flexShrink: 0,
                          borderRadius: "50%",
                          bgcolor: "#FFFFFF",
                          boxShadow: `0 0 0 4px ${alpha("#FFFFFF", 0.12)}`,
                        }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          mt: "auto",
          px: 1.5,
          pt: 1.25,
          pb: 1.5,
          borderTop: `1px solid ${alpha("#FFFFFF", 0.1)}`,
          background: alpha("#5E2016", 0.2),
        }}
      >
        <Typography
          sx={{
            px: 1.1,
            mb: 0.75,
            color: alpha("#FFFFFF", 0.45),
            fontSize: 9.5,
            fontWeight: 850,
            letterSpacing: 0.85,
            textTransform: "uppercase",
          }}
        >
          Signed in account
        </Typography>
        <ButtonBase
          onClick={() => {
            navigate("/profile");
            onClose();
          }}
          sx={{
            width: "100%",
            p: 1.15,
            borderRadius: 2.5,
            justifyContent: "flex-start",
            textAlign: "left",
            bgcolor:
              location.pathname === "/profile"
                ? alpha("#FFFFFF", 0.14)
                : alpha("#FFFFFF", 0.065),
            border: `1px solid ${alpha("#FFFFFF", location.pathname === "/profile" ? 0.2 : 0.1)}`,
            transition: "background-color 160ms ease, border-color 160ms ease",
            "&:hover": {
              bgcolor: alpha("#FFFFFF", 0.11),
              borderColor: alpha("#FFFFFF", 0.18),
            },
            "&:focus-visible": {
              outline: `2px solid ${alpha("#FFFFFF", 0.9)}`,
              outlineOffset: 2,
            },
          }}
        >
          <Avatar
            src={avatarSource || undefined}
            alt={displayName}
            sx={{
              width: 39,
              height: 39,
              bgcolor: "#FFFFFF",
              color: "#B42318",
              fontWeight: 800,
              fontSize: 13,
              border: `2px solid ${alpha("#FFFFFF", 0.65)}`,
            }}
          >
            {initials(displayName, displayEmail)}
          </Avatar>

          <Box sx={{ ml: 1.15, minWidth: 0, flexGrow: 1 }}>
            <Typography color="white" fontWeight={820} fontSize={12.75} noWrap>
              {displayName}
            </Typography>
            <Typography sx={{ color: alpha("#FFFFFF", 0.58), fontSize: 10.75, mt: 0.15 }} noWrap>
              {displayEmail || "Administrator profile"}
            </Typography>
          </Box>

          <ChevronRightRounded sx={{ color: alpha("#FFFFFF", 0.72), fontSize: 19 }} />
        </ButtonBase>
      </Box>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            border: 0,
          },
        }}
      >
        {content}
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            border: 0,
          },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
