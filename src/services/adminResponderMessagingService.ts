import {
  get,
  increment,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
  update,
} from "firebase/database";
import { auth, database } from "../firebase/config";
import type {
  AdminResponderConversation,
  AdminResponderMessage,
  Responder,
} from "../types";

const DIRECT = "ADMIN_RESPONDER" as const;
const CASE = "ADMIN_RESPONDER_CASE" as const;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function requireAdmin() {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  return actor;
}

function participantPair(firstUid: string, secondUid: string) {
  return firstUid.localeCompare(secondUid) <= 0
    ? { participantA: firstUid, participantB: secondUid }
    : { participantA: secondUid, participantB: firstUid };
}

function directConversationId(adminUid: string, responderUid: string) {
  return `admin_responder_${adminUid}_${responderUid}`;
}

function caseConversationId(adminUid: string, responderUid: string, incidentId: string) {
  return `admin_responder_case_${adminUid}_${responderUid}_${incidentId}`;
}

function messagePreview(text: string) {
  const value = clean(text);
  return value.length <= 100 ? value : `${value.slice(0, 97)}…`;
}

export async function registerAdministrationChannel(displayName?: string) {
  const actor = requireAdmin();
  const configSnapshot = await get(ref(database, "communicationConfig"));
  const currentPrimary = clean(configSnapshot.child("primaryAdminUid").val());

  if (currentPrimary && currentPrimary !== actor.uid) {
    const primarySnapshot = await get(ref(database, `admins/${currentPrimary}`));
    const primaryRole = clean(primarySnapshot.child("role").val()).toLowerCase();
    const primaryStatus = clean(
      primarySnapshot.child("accountStatus").val() || primarySnapshot.child("status").val(),
    ).toLowerCase();
    if ((primaryRole === "admin" || primaryRole === "administrator") && primaryStatus === "active") {
      return currentPrimary;
    }
  }

  await update(ref(database, "communicationConfig"), {
    primaryAdminUid: actor.uid,
    displayName: clean(displayName) || "HealthMate Administration",
    updatedAt: Date.now(),
  });
  return actor.uid;
}

async function verifyResponder(responderUid: string) {
  const uid = clean(responderUid);
  if (!uid) throw new Error("Select a responder first.");
  const snapshot = await get(ref(database, `respondents/${uid}`));
  if (!snapshot.exists()) throw new Error("The selected responder record no longer exists.");
  const status = clean(snapshot.child("accountStatus").val() || snapshot.child("status").val()).toLowerCase();
  if (status && status !== "active") {
    throw new Error("Messaging is available only for active responders.");
  }
  return uid;
}

export async function ensureAdminResponderConversation(
  responderUid: string,
  incidentId?: string,
) {
  const actor = requireAdmin();
  const responder = await verifyResponder(responderUid);
  const incident = clean(incidentId);
  const conversationId = incident
    ? caseConversationId(actor.uid, responder, incident)
    : directConversationId(actor.uid, responder);
  const conversationRef = ref(database, `conversations/${conversationId}`);
  const snapshot = await get(conversationRef);
  const now = Date.now();
  const type = incident ? CASE : DIRECT;
  const pair = participantPair(actor.uid, responder);

  if (snapshot.exists()) {
    const adminParticipant = snapshot.child("participantUids").child(actor.uid).val() === true;
    const responderParticipant = snapshot.child("participantUids").child(responder).val() === true;
    const existingType = clean(snapshot.child("conversationType").val()).toUpperCase();
    const existingIncident = clean(snapshot.child("emergencyIncidentId").val());
    if (!adminParticipant || !responderParticipant) {
      throw new Error("This conversation no longer matches the selected participants.");
    }
    if (![DIRECT, CASE].includes(existingType as typeof DIRECT | typeof CASE)) {
      throw new Error("This channel is not an administrator responder conversation.");
    }
    if (incident && existingIncident !== incident) {
      throw new Error("This case channel belongs to a different emergency incident.");
    }
  }

  const baseUpdates: Record<string, unknown> = {
    [`conversations/${conversationId}/participantUids/${actor.uid}`]: true,
    [`conversations/${conversationId}/participantUids/${responder}`]: true,
    [`conversations/${conversationId}/participantA`]: pair.participantA,
    [`conversations/${conversationId}/participantB`]: pair.participantB,
    [`conversations/${conversationId}/adminUid`]: actor.uid,
    [`conversations/${conversationId}/responderUid`]: responder,
    [`conversations/${conversationId}/conversationType`]: type,
    [`conversations/${conversationId}/updatedAt`]: now,
    [`userConversations/${actor.uid}/${conversationId}/conversationId`]: conversationId,
    [`userConversations/${actor.uid}/${conversationId}/otherParticipantUid`]: responder,
    [`userConversations/${actor.uid}/${conversationId}/conversationType`]: type,
    [`userConversations/${actor.uid}/${conversationId}/archived`]: false,
    [`userConversations/${actor.uid}/${conversationId}/muted`]: false,
    [`userConversations/${responder}/${conversationId}/conversationId`]: conversationId,
    [`userConversations/${responder}/${conversationId}/otherParticipantUid`]: actor.uid,
    [`userConversations/${responder}/${conversationId}/conversationType`]: type,
    [`userConversations/${responder}/${conversationId}/archived`]: false,
    [`userConversations/${responder}/${conversationId}/muted`]: false,
  };

  if (!snapshot.exists()) {
    baseUpdates[`conversations/${conversationId}/createdAt`] = now;
    baseUpdates[`userConversations/${actor.uid}/${conversationId}/unreadCount`] = 0;
    baseUpdates[`userConversations/${responder}/${conversationId}/unreadCount`] = 0;
  }
  if (incident) {
    baseUpdates[`conversations/${conversationId}/emergencyIncidentId`] = incident;
    baseUpdates[`userConversations/${actor.uid}/${conversationId}/emergencyIncidentId`] = incident;
    baseUpdates[`userConversations/${responder}/${conversationId}/emergencyIncidentId`] = incident;
  }
  await update(ref(database), baseUpdates);
  return conversationId;
}

async function writeMessage(
  conversationId: string,
  responderUid: string,
  text: string,
  options?: { incidentId?: string; broadcastId?: string; broadcast?: boolean; broadcastTitle?: string },
) {
  const actor = requireAdmin();
  const body = clean(text);
  if (!body) throw new Error("Enter a message before sending.");
  if (body.length > 4000) throw new Error("Messages are limited to 4,000 characters.");

  const conversationSnapshot = await get(ref(database, `conversations/${conversationId}`));
  if (!conversationSnapshot.exists()) throw new Error("The conversation is not available.");
  if (conversationSnapshot.child("participantUids").child(actor.uid).val() !== true ||
      conversationSnapshot.child("participantUids").child(responderUid).val() !== true) {
    throw new Error("You are not authorized to send to this responder channel.");
  }

  const messageReference = push(ref(database, `conversationMessages/${conversationId}`));
  if (!messageReference.key) throw new Error("Unable to allocate the message.");
  const messageId = messageReference.key;
  const notificationReference = push(ref(database, "notificationRequests"));
  const auditReference = push(ref(database, "auditLogs"));
  const now = Date.now();
  const incidentId = clean(options?.incidentId);
  const messageType = options?.broadcast ? "BROADCAST" : "TEXT";

  const message: AdminResponderMessage = {
    messageId,
    senderUid: actor.uid,
    receiverUid: responderUid,
    senderId: actor.uid,
    receiverId: responderUid,
    type: messageType,
    text: body,
    sentAt: now,
    timestamp: now,
    deliveredAt: 0,
    seenAt: 0,
    status: "SENT",
    seen: false,
    ...(options?.broadcastId ? { broadcastId: options.broadcastId } : {}),
  };

  const updates: Record<string, unknown> = {
    [`conversationMessages/${conversationId}/${messageId}`]: message,
    [`conversations/${conversationId}/lastMessageId`]: messageId,
    [`conversations/${conversationId}/lastMessageText`]: messagePreview(body),
    [`conversations/${conversationId}/lastMessageType`]: messageType,
    [`conversations/${conversationId}/lastMessageSenderUid`]: actor.uid,
    [`conversations/${conversationId}/lastMessageAt`]: now,
    [`conversations/${conversationId}/updatedAt`]: now,
    [`userConversations/${actor.uid}/${conversationId}/lastMessageText`]: messagePreview(body),
    [`userConversations/${actor.uid}/${conversationId}/lastMessageType`]: messageType,
    [`userConversations/${actor.uid}/${conversationId}/lastMessageSenderUid`]: actor.uid,
    [`userConversations/${actor.uid}/${conversationId}/lastMessageAt`]: now,
    [`userConversations/${actor.uid}/${conversationId}/archived`]: false,
    [`userConversations/${responderUid}/${conversationId}/lastMessageText`]: messagePreview(body),
    [`userConversations/${responderUid}/${conversationId}/lastMessageType`]: messageType,
    [`userConversations/${responderUid}/${conversationId}/lastMessageSenderUid`]: actor.uid,
    [`userConversations/${responderUid}/${conversationId}/lastMessageAt`]: now,
    [`userConversations/${responderUid}/${conversationId}/archived`]: false,
    [`userConversations/${responderUid}/${conversationId}/unreadCount`]: increment(1),
  };

  if (notificationReference.key) {
    updates[`notificationRequests/${notificationReference.key}`] = {
      targetUserId: responderUid,
      title: options?.broadcast
        ? clean(options.broadcastTitle) || "Official HealthMate notice"
        : incidentId
          ? `Emergency case ${incidentId}`
          : "HealthMate Administration",
      message: body,
      body,
      type: "chat_message",
      priority: incidentId ? "HIGH" : "NORMAL",
      createdBy: actor.uid,
      conversationId,
      messageId,
      relatedEntityId: conversationId,
      ...(incidentId ? { incidentId, emergencyId: incidentId } : {}),
      status: "queued",
      createdAt: now,
    };
  }
  if (auditReference.key) {
    updates[`auditLogs/${auditReference.key}`] = {
      action: options?.broadcast ? "Responder broadcast sent" : "Responder message sent",
      performedBy: actor.uid,
      details: incidentId
        ? `Message sent to responder ${responderUid} for emergency ${incidentId}`
        : `Message sent to responder ${responderUid}`,
      timestamp: now,
    };
  }
  await update(ref(database), updates);
}

export async function sendAdminResponderMessage(input: {
  responderUid: string;
  text: string;
  incidentId?: string;
}) {
  const conversationId = await ensureAdminResponderConversation(input.responderUid, input.incidentId);
  await writeMessage(conversationId, clean(input.responderUid), input.text, {
    incidentId: input.incidentId,
  });
  return conversationId;
}

export async function sendResponderBroadcast(input: {
  responders: Responder[];
  text: string;
  title?: string;
}) {
  const actor = requireAdmin();
  const body = clean(input.text);
  if (!body) throw new Error("Enter the official notice before sending.");
  const active = input.responders.filter((item) => clean(item.accountStatus).toLowerCase() === "active");
  if (active.length === 0) throw new Error("Select at least one active responder.");

  const broadcastReference = push(ref(database, "responderBroadcasts"));
  if (!broadcastReference.key) throw new Error("Unable to allocate the broadcast notice.");
  const broadcastId = broadcastReference.key;
  const now = Date.now();
  await set(broadcastReference, {
    id: broadcastId,
    title: clean(input.title) || "Official HealthMate notice",
    message: body,
    createdBy: actor.uid,
    createdAt: now,
    recipientCount: active.length,
  });

  const deliveries = await Promise.allSettled(
    active.map(async (responder) => {
      const responderUid = responder.authUid || responder.id;
      const conversationId = await ensureAdminResponderConversation(responderUid);
      await writeMessage(conversationId, responderUid, body, {
        broadcast: true,
        broadcastId,
        broadcastTitle: clean(input.title) || "Official HealthMate notice",
      });
      return responderUid;
    }),
  );

  const sentCount = deliveries.filter((item) => item.status === "fulfilled").length;
  const failedCount = deliveries.length - sentCount;
  await update(broadcastReference, {
    sentCount,
    failedCount,
    status: failedCount === 0 ? "SENT" : sentCount > 0 ? "PARTIAL" : "FAILED",
    completedAt: Date.now(),
  });

  if (sentCount === 0) {
    throw new Error("The notice could not be delivered to any selected responder.");
  }
  return { broadcastId, recipientCount: active.length, sentCount, failedCount };
}

export function listenAdminResponderConversations(
  callback: (items: AdminResponderConversation[]) => void,
  onError?: (error: Error) => void,
) {
  const actor = requireAdmin();
  const inboxQuery = query(
    ref(database, `userConversations/${actor.uid}`),
    orderByChild("lastMessageAt"),
  );
  return onValue(inboxQuery, (snapshot) => {
    const items: AdminResponderConversation[] = [];
    snapshot.forEach((child) => {
      const value = child.val() as Partial<AdminResponderConversation> | null;
      if (!value) return;
      const type = clean(value.conversationType).toUpperCase();
      if (type !== DIRECT && type !== CASE) return;
      items.push({
        conversationId: clean(value.conversationId) || child.key || "",
        otherParticipantUid: clean(value.otherParticipantUid),
        conversationType: type as AdminResponderConversation["conversationType"],
        emergencyIncidentId: clean(value.emergencyIncidentId) || undefined,
        lastMessageText: clean(value.lastMessageText),
        lastMessageType: clean(value.lastMessageType),
        lastMessageSenderUid: clean(value.lastMessageSenderUid),
        lastMessageAt: Number(value.lastMessageAt || 0),
        unreadCount: Number(value.unreadCount || 0),
        archived: Boolean(value.archived),
        muted: Boolean(value.muted),
      });
    });
    items.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    callback(items);
  }, onError);
}

export function listenConversationMessages(
  conversationId: string,
  callback: (items: AdminResponderMessage[]) => void,
  onError?: (error: Error) => void,
) {
  const id = clean(conversationId);
  if (!id) return () => undefined;
  const messagesQuery = query(
    ref(database, `conversationMessages/${id}`),
    orderByChild("sentAt"),
    limitToLast(200),
  );
  return onValue(messagesQuery, (snapshot) => {
    const items: AdminResponderMessage[] = [];
    snapshot.forEach((child) => {
      const value = child.val() as AdminResponderMessage | null;
      if (!value) return;
      items.push({ ...value, messageId: clean(value.messageId) || child.key || "" });
    });
    items.sort((a, b) => Number(a.sentAt || a.timestamp || 0) - Number(b.sentAt || b.timestamp || 0));
    callback(items);
    void markAdminConversationRead(id, items);
  }, onError);
}

export async function markAdminConversationRead(
  conversationId: string,
  messages?: AdminResponderMessage[],
) {
  const actor = requireAdmin();
  const id = clean(conversationId);
  if (!id) return;
  let items = messages;
  if (!items) {
    const snapshot = await get(ref(database, `conversationMessages/${id}`));
    items = [];
    snapshot.forEach((child) => {
      const value = child.val() as AdminResponderMessage | null;
      if (value) items!.push({ ...value, messageId: clean(value.messageId) || child.key || "" });
    });
  }
  const now = Date.now();
  const updates: Record<string, unknown> = {
    [`userConversations/${actor.uid}/${id}/unreadCount`]: 0,
    [`userConversations/${actor.uid}/${id}/lastOpenedAt`]: now,
  };
  for (const message of items) {
    if (clean(message.receiverUid || message.receiverId) !== actor.uid || !message.messageId) continue;
    if (!message.deliveredAt) updates[`conversationMessages/${id}/${message.messageId}/deliveredAt`] = now;
    if (!message.seenAt) {
      updates[`conversationMessages/${id}/${message.messageId}/seenAt`] = now;
      updates[`conversationMessages/${id}/${message.messageId}/seen`] = true;
      updates[`conversationMessages/${id}/${message.messageId}/status`] = "SEEN";
    }
  }
  await update(ref(database), updates);
}

export async function setConversationArchived(conversationId: string, archived: boolean) {
  const actor = requireAdmin();
  await update(ref(database, `userConversations/${actor.uid}/${clean(conversationId)}`), {
    archived,
    archivedAt: archived ? Date.now() : null,
  });
}
