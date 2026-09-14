import { Box, Container, Toolbar } from "@mui/material";
import { useState } from "react";
import EmergencyRealtimeNotifier from "../notifications/EmergencyRealtimeNotifier";
import Header from "./Header";
import Sidebar, { drawerWidth } from "./Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <EmergencyRealtimeNotifier />
      <Header onMenuClick={() => setMobileOpen(true)} />
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          position: "relative",
          background: "radial-gradient(circle at 92% 3%, rgba(20,184,166,0.08), transparent 28%), #F5F8FA",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 68, md: 76 } }} />
        <Container maxWidth={false} sx={{ maxWidth: 1680, py: { xs: 2.5, md: 4 }, px: { xs: 1.75, sm: 3, lg: 4 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
