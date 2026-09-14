import {
  ArchiveOutlined,
  CampaignOutlined,
  CheckCircleRounded,
  DoneAllRounded,
  ForumOutlined,
  MedicalServicesOutlined,
  SearchRounded,
  SendRounded,
  ShieldOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/common/PageHeader";
import { useAuth } from "../context/AuthContext";
import {
  ensureAdminResponderConversation,
  listenAdminResponderConversations,
  listenConversationMessages,
  registerAdministrationChannel,
  sendAdminResponderMessage,
  sendResponderBroadcast,
  setConversationArchived,
} from "../services/adminResponderMessagingService";
import { listenResponders } from "../services/responderService";
import type {
  AdminResponderConversation,
  AdminResponderMessage,
  Responder,
} from "../types";

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "R";
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

function availabilityLabel(value?: string) {
  return String(value || "OFF_DUTY").replace(/_/g, " ");
}

function availabilityColor(value?: string): "success" | "warning" | "default" {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "AVAILABLE") return "success";
  if (normalized === "BUSY") return "warning";
  return "default";
}

function timeLabel(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const { user, adminProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<"messages" | "broadcast">("messages");
  const [responders, setResponders] = useState<Responder[]>([]);
  const [conversations, setConversations] = useState<AdminResponderConversation[]>([]);
  const [selectedResponderUid, setSelectedResponderUid] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [messages, setMessages] = useState<AdminResponderMessage[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("Official HealthMate notice");
  const [broadcastRecipients, setBroadcastRecipients] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void registerAdministrationChannel(adminProfile?.fullName || user?.displayName || "HealthMate Administration").catch(() => undefined);
    const stopResponders = listenResponders(setResponders, (caught) => setError(caught.message));
    const stopConversations = listenAdminResponderConversations(setConversations, (caught) => setError(caught.message));
    return () => {
      stopResponders();
      stopConversations();
    };
  }, [adminProfile?.fullName, user?.displayName]);

  useEffect(() => {
    const requestedResponder = searchParams.get("responderUid")?.trim() || "";
    const requestedIncident = searchParams.get("incidentId")?.trim() || "";
    if (!requestedResponder) return;
    setSelectedResponderUid(requestedResponder);
    setSelectedIncidentId(requestedIncident);
    setLoadingConversation(true);
    ensureAdminResponderConversation(requestedResponder, requestedIncident || undefined)
      .then((id) => setSelectedConversationId(id))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to open the responder conversation."))
      .finally(() => setLoadingConversation(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    return listenConversationMessages(
      selectedConversationId,
      setMessages,
      (caught) => setError(caught.message),
    );
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedConversationId]);

  const conversationByResponder = useMemo(() => {
    const map = new Map<string, AdminResponderConversation[]>();
    for (const conversation of conversations) {
      const existing = map.get(conversation.otherParticipantUid) || [];
      existing.push(conversation);
      map.set(conversation.otherParticipantUid, existing);
    }
    return map;
  }, [conversations]);

  const filteredResponders = useMemo(() => {
    const queryValue = search.trim().toLowerCase();
    return responders
      .filter((item) => String(item.accountStatus || "").toLowerCase() === "active")
      .filter((item) => !queryValue || [item.name, item.position, item.contact, item.email, item.serviceArea]
        .filter(Boolean).join(" ").toLowerCase().includes(queryValue))
      .sort((a, b) => {
        const aLatest = Math.max(0, ...(conversationByResponder.get(a.authUid || a.id) || []).map((item) => item.lastMessageAt));
        const bLatest = Math.max(0, ...(conversationByResponder.get(b.authUid || b.id) || []).map((item) => item.lastMessageAt));
        return bLatest - aLatest || a.name.localeCompare(b.name);
      });
  }, [responders, search, conversationByResponder]);

  const selectedResponder = responders.find((item) => (item.authUid || item.id) === selectedResponderUid) || null;
  const selectedConversation = conversations.find((item) => item.conversationId === selectedConversationId) || null;
  const totalUnread = conversations.reduce((sum, item) => sum + Math.max(0, item.unreadCount || 0), 0);

  async function openResponder(responder: Responder, incidentId?: string) {
    const uid = responder.authUid || responder.id;
    const caseId = incidentId?.trim() || "";
    setError("");
    setSuccess("");
    setSelectedResponderUid(uid);
    setSelectedIncidentId(caseId);
    setLoadingConversation(true);
    try {
      const conversationId = await ensureAdminResponderConversation(uid, caseId || undefined);
      setSelectedConversationId(conversationId);
      if (caseId) setSearchParams({ responderUid: uid, incidentId: caseId }, { replace: true });
      else setSearchParams({ responderUid: uid }, { replace: true });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to open the responder conversation.");
    } finally {
      setLoadingConversation(false);
    }
  }

  async function sendMessage() {
    if (!selectedResponder || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const conversationId = await sendAdminResponderMessage({
        responderUid: selectedResponder.authUid || selectedResponder.id,
        text: draft,
        incidentId: selectedIncidentId || selectedConversation?.emergencyIncidentId,
      });
      setSelectedConversationId(conversationId);
      setDraft("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  async function archiveCurrent() {
    if (!selectedConversationId) return;
    await setConversationArchived(selectedConversationId, true);
    setSuccess("Conversation archived. The message history was preserved.");
  }

  async function sendBroadcast() {
    const selected = responders.filter((item) => broadcastRecipients.has(item.authUid || item.id));
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendResponderBroadcast({ responders: selected, text: broadcastText, title: broadcastTitle });
      setBroadcastText("");
      setBroadcastRecipients(new Set());
      if (result.failedCount > 0) {
        setError(`Notice sent to ${result.sentCount} of ${result.recipientCount} responders. ${result.failedCount === 1 ? "1 delivery failed" : `${result.failedCount} deliveries failed`}.`);
      } else {
        setSuccess(`Official notice sent to ${result.sentCount} responder${result.sentCount === 1 ? "" : "s"}.`);
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Unable to send the official notice.");
    } finally {
      setSending(false);
    }
  }

  function selectAllActive() {
    setBroadcastRecipients(new Set(
      responders
        .filter((item) => String(item.accountStatus || "").toLowerCase() === "active")
        .map((item) => item.authUid || item.id),
    ));
  }

  return (
    <Stack spacing={2.25}>
      <PageHeader
        eyebrow="Communication & coordination"
        title="Responder communications"
        description="Coordinate privately with responders, keep emergency instructions linked to the correct case, and send official notices without creating group chats."
      />

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tab value="messages" icon={<Badge badgeContent={totalUnread} color="error"><ForumOutlined /></Badge>} iconPosition="start" label="Direct & case messages" />
          <Tab value="broadcast" icon={<CampaignOutlined />} iconPosition="start" label="Official broadcast" />
        </Tabs>

        {tab === "messages" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "330px minmax(0,1fr) 290px" }, minHeight: { xs: 620, lg: 690 } }}>
            <Box sx={{ borderRight: { lg: "1px solid" }, borderColor: "divider", minWidth: 0 }}>
              <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search responders"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
                />
              </Box>
              <Box sx={{ maxHeight: { xs: 300, lg: 620 }, overflowY: "auto" }}>
                {filteredResponders.map((responder) => {
                  const uid = responder.authUid || responder.id;
                  const responderConversations = conversationByResponder.get(uid) || [];
                  const latest = responderConversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];
                  const unread = responderConversations.reduce((sum, item) => sum + item.unreadCount, 0);
                  const selected = uid === selectedResponderUid;
                  return (
                    <Box
                      key={uid}
                      component="button"
                      type="button"
                      onClick={() => void openResponder(responder)}
                      sx={{
                        width: "100%", border: 0, borderBottom: "1px solid", borderColor: "divider", bgcolor: selected ? alpha("#0B7F88", 0.08) : "transparent",
                        p: 1.6, textAlign: "left", cursor: "pointer", "&:hover": { bgcolor: alpha("#0B7F88", 0.055) },
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Badge color="success" variant="dot" invisible={responder.availability !== "AVAILABLE"} overlap="circular" anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                          <Avatar sx={{ width: 44, height: 44, bgcolor: "primary.main", fontWeight: 800 }}>{initials(responder.name)}</Avatar>
                        </Badge>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography fontWeight={800} noWrap>{responder.name}</Typography>
                            <Typography fontSize={11.5} color="text.secondary">{timeLabel(latest?.lastMessageAt)}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.25 }}>
                            <Typography fontSize={12.5} color="text.secondary" noWrap sx={{ flex: 1 }}>
                              {latest?.lastMessageText || responder.position || "Start an administration conversation"}
                            </Typography>
                            {unread > 0 && <Chip size="small" color="error" label={unread > 99 ? "99+" : unread} sx={{ height: 21, fontWeight: 800 }} />}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
                {filteredResponders.length === 0 && <Box sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">No active responders match your search.</Typography></Box>}
              </Box>
            </Box>

            <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", bgcolor: alpha("#F8FAFC", 0.6), borderRight: { lg: "1px solid" }, borderColor: "divider" }}>
              {!selectedResponder ? (
                <Box sx={{ flex: 1, display: "grid", placeItems: "center", p: 4, textAlign: "center" }}>
                  <Box><ForumOutlined sx={{ fontSize: 54, color: "primary.main", opacity: 0.65 }} /><Typography variant="h6" sx={{ mt: 1 }}>Select a responder</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Choose an active responder to start or continue a secure administration conversation.</Typography></Box>
                </Box>
              ) : (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ px: 2.2, py: 1.5, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900} noWrap>{selectedResponder.name}</Typography>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.35 }}>
                        <Chip size="small" color={availabilityColor(selectedResponder.availability)} variant="outlined" label={availabilityLabel(selectedResponder.availability)} />
                        {(selectedIncidentId || selectedConversation?.emergencyIncidentId) && <Chip size="small" color="error" variant="outlined" icon={<MedicalServicesOutlined />} label={`Case ${selectedIncidentId || selectedConversation?.emergencyIncidentId}`} />}
                      </Stack>
                    </Box>
                    <Tooltip title="Archive conversation"><span><IconButton onClick={() => void archiveCurrent()} disabled={!selectedConversationId}><ArchiveOutlined /></IconButton></span></Tooltip>
                  </Stack>

                  <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 1.5, sm: 2.5 }, py: 2 }}>
                    {loadingConversation && <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress size={28} /></Box>}
                    {!loadingConversation && messages.length === 0 && (
                      <Alert severity="info" icon={<ShieldOutlined />}>This secure administration channel has no messages yet. Messages are visible only to the administrator and this responder.</Alert>
                    )}
                    <Stack spacing={1.15}>
                      {messages.map((message) => {
                        const own = message.senderUid === user?.uid;
                        return (
                          <Stack key={message.messageId} alignItems={own ? "flex-end" : "flex-start"}>
                            <Box sx={{ maxWidth: "78%", px: 1.6, py: 1.1, borderRadius: own ? "18px 18px 5px 18px" : "18px 18px 18px 5px", bgcolor: own ? "primary.main" : "background.paper", color: own ? "primary.contrastText" : "text.primary", border: own ? 0 : "1px solid", borderColor: "divider", boxShadow: own ? "none" : "0 1px 3px rgba(16,24,40,.05)" }}>
                              {message.type === "BROADCAST" && <Typography fontSize={10.5} fontWeight={900} sx={{ mb: 0.35, textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.78 }}>Official notice</Typography>}
                              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>{message.text}</Typography>
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ mt: 0.45, opacity: 0.76 }}>
                                <Typography fontSize={10.5}>{timeLabel(message.sentAt || message.timestamp)}</Typography>
                                {own && (message.seenAt ? <DoneAllRounded sx={{ fontSize: 14 }} /> : message.deliveredAt ? <DoneAllRounded sx={{ fontSize: 14 }} /> : <CheckCircleRounded sx={{ fontSize: 12 }} />)}
                              </Stack>
                            </Box>
                          </Stack>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ p: 1.5, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
                    <TextField
                      fullWidth multiline maxRows={4} placeholder="Write a message to this responder"
                      value={draft} onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
                      disabled={sending}
                    />
                    <Button variant="contained" onClick={() => void sendMessage()} disabled={sending || !draft.trim()} sx={{ minWidth: 54, height: 52 }}>
                      {sending ? <CircularProgress size={22} color="inherit" /> : <SendRounded />}
                    </Button>
                  </Stack>
                </>
              )}
            </Box>

            <Box sx={{ p: 2.2, display: { xs: selectedResponder ? "block" : "none", lg: "block" } }}>
              {selectedResponder ? (
                <Stack spacing={2}>
                  <Stack alignItems="center" spacing={1.1} sx={{ py: 1.5 }}>
                    <Avatar sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 24, fontWeight: 900 }}>{initials(selectedResponder.name)}</Avatar>
                    <Box sx={{ textAlign: "center" }}><Typography fontWeight={900}>{selectedResponder.name}</Typography><Typography color="text.secondary" fontSize={13}>{selectedResponder.position || "Emergency Responder"}</Typography></Box>
                    <Chip size="small" color={availabilityColor(selectedResponder.availability)} label={availabilityLabel(selectedResponder.availability)} />
                  </Stack>
                  <Divider />
                  <Box><Typography fontSize={11.5} fontWeight={900} color="text.secondary" textTransform="uppercase">Contact</Typography><Typography sx={{ mt: 0.4 }}>{selectedResponder.contact || "Not provided"}</Typography></Box>
                  <Box><Typography fontSize={11.5} fontWeight={900} color="text.secondary" textTransform="uppercase">Service area</Typography><Typography sx={{ mt: 0.4 }}>{selectedResponder.serviceArea || selectedResponder.assignedBarangayId || "Not assigned"}</Typography></Box>
                  <Box><Typography fontSize={11.5} fontWeight={900} color="text.secondary" textTransform="uppercase">Channel</Typography><Typography sx={{ mt: 0.4 }}>{selectedIncidentId || selectedConversation?.emergencyIncidentId ? "Emergency case communication" : "Direct administration communication"}</Typography></Box>
                  <Alert severity="info" icon={<ShieldOutlined />}>Conversation history is retained for operational accountability. Archive completed threads instead of deleting them.</Alert>
                </Stack>
              ) : <Typography color="text.secondary">Responder details appear after you select a conversation.</Typography>}
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, md: 3 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 360px" }, gap: 2.5 }}>
            <Stack spacing={2}>
              <Alert severity="info" icon={<CampaignOutlined />}>Broadcasts are delivered privately to each selected responder. No responder group chat is created, and replies return to the administrator as individual conversations.</Alert>
              <TextField label="Notice title" value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} inputProps={{ maxLength: 100 }} />
              <TextField label="Official notice" multiline minRows={7} value={broadcastText} onChange={(event) => setBroadcastText(event.target.value)} inputProps={{ maxLength: 4000 }} placeholder="Write the operational notice or coordination instruction." />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" onClick={selectAllActive}>Select all active responders</Button>
                <Button variant="text" onClick={() => setBroadcastRecipients(new Set())}>Clear selection</Button>
              </Stack>
              <Button variant="contained" size="large" startIcon={<CampaignOutlined />} onClick={() => void sendBroadcast()} disabled={sending || !broadcastText.trim() || broadcastRecipients.size === 0}>
                {sending ? "Sending notice…" : `Send to ${broadcastRecipients.size} responder${broadcastRecipients.size === 1 ? "" : "s"}`}
              </Button>
            </Stack>
            <Paper variant="outlined" sx={{ overflow: "hidden", maxHeight: 560 }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}><Typography fontWeight={900}>Recipients</Typography><Typography color="text.secondary" fontSize={12.5}>Choose exactly who should receive this notice.</Typography></Box>
              <Box sx={{ overflowY: "auto", maxHeight: 490 }}>
                {responders.filter((item) => String(item.accountStatus || "").toLowerCase() === "active").map((responder) => {
                  const uid = responder.authUid || responder.id;
                  const checked = broadcastRecipients.has(uid);
                  return <Stack key={uid} direction="row" alignItems="center" spacing={1} sx={{ px: 1.2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Checkbox checked={checked} onChange={() => setBroadcastRecipients((current) => { const next = new Set(current); if (next.has(uid)) next.delete(uid); else next.add(uid); return next; })} />
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 13 }}>{initials(responder.name)}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={800} fontSize={13.5} noWrap>{responder.name}</Typography><Typography fontSize={11.5} color="text.secondary" noWrap>{availabilityLabel(responder.availability)} · {responder.position || "Responder"}</Typography></Box>
                  </Stack>;
                })}
              </Box>
            </Paper>
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
