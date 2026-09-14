import { ArrowBackRounded } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import BrandLogo from "./components/common/BrandLogo";
import AdminLayout from "./components/layout/AdminLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AdminProfile from "./pages/AdminProfile";
import Announcements from "./pages/Announcements";
import AuditLogs from "./pages/AuditLogs";
import Dashboard from "./pages/Dashboard";
import Emergencies from "./pages/Emergencies";
import EmergencyDirectory from "./pages/EmergencyDirectory";
import LiveMap from "./pages/LiveMap";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import RescueReports from "./pages/RescueReports";
import Residents from "./pages/Residents";
import Responders from "./pages/Responders";
import InhabitantsProfiling from "./pages/InhabitantsProfiling";
import MonitoringReports from "./pages/MonitoringReports";
import IncidentHeatmap from "./pages/IncidentHeatmap";
import ProtectedRoute from "./routes/ProtectedRoute";
import type { AdminRole } from "./types";

const administratorRoles: AdminRole[] = ["administrator", "admin"];
function SecuredPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={administratorRoles}><AdminLayout>{children}</AdminLayout></ProtectedRoute>;
}
function MessagePage({ title, message }: { title: string; message: string }) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const returnPath = user && role ? "/dashboard" : "/";
  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, background: "radial-gradient(circle at 80% 10%, rgba(16,191,178,0.16), transparent 30%), linear-gradient(180deg, #FAFDFF, #EAF7FC)" }}><Card sx={{ width: "100%", maxWidth: 560 }}><CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}><Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}><BrandLogo subtitle="Administration Portal" /></Box><Typography variant="h4" gutterBottom>{title}</Typography><Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>{message}</Typography><Button variant="contained" startIcon={<ArrowBackRounded />} onClick={() => navigate(returnPath, { replace: true })}>{returnPath === "/" ? "Return to sign in" : "Return to dashboard"}</Button></CardContent></Card></Box>;
}
export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/" element={<Login />} /><Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/dashboard" element={<SecuredPage><Dashboard /></SecuredPage>} />
    <Route path="/profile" element={<SecuredPage><AdminProfile /></SecuredPage>} />
    <Route path="/emergencies" element={<SecuredPage><Emergencies /></SecuredPage>} />
    <Route path="/emergencies/:incidentId" element={<SecuredPage><Emergencies /></SecuredPage>} />
    <Route path="/map" element={<SecuredPage><LiveMap /></SecuredPage>} />
    <Route path="/residents" element={<SecuredPage><Residents /></SecuredPage>} />
    <Route path="/inhabitants" element={<SecuredPage><InhabitantsProfiling /></SecuredPage>} />
    <Route path="/monitoring-reports" element={<SecuredPage><MonitoringReports /></SecuredPage>} />
    <Route path="/incident-heatmap" element={<SecuredPage><IncidentHeatmap /></SecuredPage>} />
    <Route path="/responders" element={<SecuredPage><Responders /></SecuredPage>} />
    <Route path="/directory" element={<SecuredPage><EmergencyDirectory /></SecuredPage>} />
    <Route path="/rescue-reports" element={<SecuredPage><RescueReports /></SecuredPage>} />
    <Route path="/announcements" element={<SecuredPage><Announcements /></SecuredPage>} />
    <Route path="/reports" element={<SecuredPage><Reports /></SecuredPage>} />
    <Route path="/audit" element={<SecuredPage><AuditLogs /></SecuredPage>} />
    <Route path="/unauthorized" element={<MessagePage title="Access restricted" message="Only active HealthMate administrator accounts may use this web portal. Respondents must use the Android app." />} />
    <Route path="*" element={<MessagePage title="Page not found" message="The requested HealthMate administration page does not exist." />} />
  </Routes></BrowserRouter></AuthProvider>;
}
