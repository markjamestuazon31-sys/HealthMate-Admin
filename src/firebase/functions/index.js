"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const { onValueCreated } = require("firebase-functions/v2/database");

initializeApp();

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/**
 * Processes the canonical /notificationRequests queue used by both the Android
 * app and the administrator portal. The inbox write is idempotent: Android may
 * have already written the same notification ID while creating an SOS.
 */
exports.sendQueuedHealthMateNotification = onValueCreated(
  "/notificationRequests/{requestId}",
  async (event) => {
    const requestId = event.params.requestId;
    const request = event.data.val() || {};
    const targetUserId = stringValue(request.targetUserId);

    if (!targetUserId) {
      await event.data.ref.update({
        status: "failed",
        failureReason: "missing_target_user",
        processedAt: Date.now(),
      });
      return;
    }

    const type = stringValue(request.type, "general");
    const incidentId = firstNonBlank(request.incidentId, request.emergencyId);
    const urgent = isUrgent(type, request.priority);
    const createdAt = numberValue(request.createdAt, Date.now());
    const inboxRef = getDatabase().ref(`notifications/${targetUserId}/${requestId}`);

    await inboxRef.transaction((current) => current || {
      title: stringValue(request.title, "HealthMate"),
      message: stringValue(request.message || request.body, "Open HealthMate to view the update."),
      type,
      priority: urgent ? "HIGH" : "NORMAL",
      emergencyId: incidentId,
      incidentId,
      callId: stringValue(request.callId),
      announcementId: stringValue(request.announcementId),
      createdBy: stringValue(request.createdBy),
      createdAt,
      read: false,
    });

    const tokenRecords = await readUserTokens(targetUserId);
    if (tokenRecords.length === 0) {
      await event.data.ref.update({
        status: "no_tokens",
        pushSuccessCount: 0,
        pushFailureCount: 0,
        inboxWritten: true,
        processedAt: Date.now(),
      });
      logger.info("No HealthMate Android token registered", { requestId, targetUserId });
      return;
    }

    const data = {
      notificationId: requestId,
      title: stringValue(request.title, "HealthMate"),
      message: stringValue(
        request.message || request.body,
        urgent ? "A HealthMate contact needs immediate assistance." : "Open HealthMate to view the update.",
      ),
      type,
      priority: urgent ? "HIGH" : "NORMAL",
      targetUserId,
      userId: stringValue(request.userId || request.createdBy),
      createdBy: stringValue(request.createdBy),
      incidentId,
      emergencyId: incidentId,
      callId: stringValue(request.callId),
      announcementId: stringValue(request.announcementId),
    };

    let successCount = 0;
    let failureCount = 0;
    const staleTokenPaths = [];

    for (let offset = 0; offset < tokenRecords.length; offset += 500) {
      const chunk = tokenRecords.slice(offset, offset + 500);
      const response = await getMessaging().sendEachForMulticast({
        tokens: chunk.map((record) => record.token),
        data,
        android: {
          priority: urgent ? "high" : "normal",
          ttl: urgent ? 300_000 : 3_600_000,
        },
      });

      successCount += response.successCount;
      failureCount += response.failureCount;
      response.responses.forEach((item, index) => {
        if (!item.success && item.error && INVALID_TOKEN_CODES.has(item.error.code)) {
          staleTokenPaths.push(...chunk[index].paths);
        }
      });
    }

    const updates = {};
    for (const path of new Set(staleTokenPaths)) updates[path] = null;
    updates[`notificationRequests/${requestId}/status`] = successCount > 0 ? "sent" : "failed";
    updates[`notificationRequests/${requestId}/pushSuccessCount`] = successCount;
    updates[`notificationRequests/${requestId}/pushFailureCount`] = failureCount;
    updates[`notificationRequests/${requestId}/inboxWritten`] = true;
    updates[`notificationRequests/${requestId}/processedAt`] = Date.now();
    await getDatabase().ref().update(updates);

    logger.info("HealthMate queued notification processed", {
      requestId,
      targetUserId,
      urgent,
      successCount,
      failureCount,
      removedTokenCount: new Set(staleTokenPaths).size,
    });
  },
);

async function readUserTokens(uid) {
  const database = getDatabase();
  const [userSnapshot, rootSnapshot] = await Promise.all([
    database.ref(`users/${uid}`).get(),
    database.ref(`fcmTokens/${uid}`).get(),
  ]);
  const byToken = new Map();
  const add = (token, path) => {
    const normalized = stringValue(token);
    if (!normalized) return;
    const existing = byToken.get(normalized) || { token: normalized, paths: [] };
    existing.paths.push(path);
    byToken.set(normalized, existing);
  };

  if (userSnapshot.exists()) {
    add(userSnapshot.child("fcmToken").val(), `users/${uid}/fcmToken`);
    userSnapshot.child("fcmTokens").forEach((child) => {
      const record = child.val();
      if (typeof record === "string") add(record, `users/${uid}/fcmTokens/${child.key}`);
      else if (record && record.active !== false) add(record.token, `users/${uid}/fcmTokens/${child.key}`);
    });
  }
  if (rootSnapshot.exists()) {
    rootSnapshot.forEach((child) => {
      const record = child.val();
      if (typeof record === "string") add(record, `fcmTokens/${uid}/${child.key}`);
      else if (record && record.active !== false) add(record.token, `fcmTokens/${uid}/${child.key}`);
    });
  }
  return Array.from(byToken.values());
}

function isUrgent(type, priority) {
  const normalizedType = stringValue(type).toLowerCase();
  const normalizedPriority = stringValue(priority).toUpperCase();
  return normalizedPriority === "HIGH" || normalizedType === "emergency_sos" || normalizedType === "emergency_alert" || normalizedType === "emergency_backup" || normalizedType.startsWith("sos") || normalizedType === "incoming_call" || normalizedType === "critical_alert";
}
function firstNonBlank(first, second) { return stringValue(first) || stringValue(second); }
function stringValue(value, fallback = "") { if (value === null || value === undefined) return fallback; const text = String(value).trim(); return text || fallback; }
function numberValue(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
