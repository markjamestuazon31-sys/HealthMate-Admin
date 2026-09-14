import { onValue, push, ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementStatus,
} from "../types";

const ANNOUNCEMENTS_PATH = "announcements";
const AUDIT_LOGS_PATH = "auditLogs";
const MAX_IMAGE_CHARACTERS = 900_000;

function asCategory(value: unknown): AnnouncementCategory {
  return String(value ?? "Barangay News") as AnnouncementCategory;
}

function asStatus(value: unknown): AnnouncementStatus {
  const status = String(value ?? "published").toLowerCase();
  if (status === "draft" || status === "archived") return status;
  return "published";
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function listenAnnouncements(callback: (data: Announcement[]) => void, onError?: (error: Error) => void) {
  return onValue(ref(database, ANNOUNCEMENTS_PATH), (snapshot) => {
    const raw = snapshot.val() as Record<string, Partial<Announcement>> | null;
    const announcements: Announcement[] = raw
      ? Object.entries(raw)
          .map(([id, value]) => ({
            id,
            title: value.title?.trim() || "Untitled announcement",
            content: value.content?.trim() || "",
            category: asCategory(value.category),
            status: asStatus(value.status),
            createdBy: value.createdBy,
            createdAt: Number(value.createdAt) || 0,
            updatedAt: Number(value.updatedAt) || Number(value.createdAt) || 0,
            expiresAt: Number(value.expiresAt) || 0,
            targetAudience: value.targetAudience ?? "all",
            imageData: optionalText(value.imageData),
            imageMimeType: optionalText(value.imageMimeType),
          }))
          .sort((a, b) => b.createdAt - a.createdAt)
      : [];
    callback(announcements);
  }, onError);
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category: AnnouncementCategory;
  expiresAt?: number;
  imageData?: string;
  imageMimeType?: string;
}

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your administrator session has expired. Sign in again.");
  }

  const title = input.title.trim();
  const content = input.content.trim();
  const imageData = input.imageData?.trim() || "";
  const imageMimeType = input.imageMimeType?.trim() || "";

  if (!title) throw new Error("Announcement title is required.");
  if (!content) throw new Error("Announcement message is required.");
  if (title.length > 120) {
    throw new Error("Announcement title must be 120 characters or fewer.");
  }
  if (content.length > 5000) {
    throw new Error("Announcement message must be 5,000 characters or fewer.");
  }
  if (imageData.length > MAX_IMAGE_CHARACTERS) {
    throw new Error("The processed announcement image is too large.");
  }
  if (imageData && imageMimeType !== "image/jpeg") {
    throw new Error("Announcement images must be processed as JPEG.");
  }

  const announcementId = push(ref(database, ANNOUNCEMENTS_PATH)).key;
  const auditId = push(ref(database, AUDIT_LOGS_PATH)).key;
  if (!announcementId || !auditId) {
    throw new Error("Unable to allocate Firebase record IDs.");
  }

  const now = Date.now();
  const expiresAt = Number(input.expiresAt) || 0;
  if (expiresAt > 0 && expiresAt <= now) {
    throw new Error("The expiry date must be in the future.");
  }

  const announcement: Omit<Announcement, "id"> = {
    title,
    content,
    category: input.category,
    status: "published",
    createdBy: currentUser.uid,
    createdAt: now,
    updatedAt: now,
    expiresAt,
    targetAudience: "all",
    ...(imageData ? { imageData, imageMimeType: "image/jpeg" } : {}),
  };

  await update(ref(database), {
    [`${ANNOUNCEMENTS_PATH}/${announcementId}`]: announcement,
    [`${AUDIT_LOGS_PATH}/${auditId}`]: {
      action: "Announcement published",
      performedBy: currentUser.uid,
      details: `${input.category}: ${title}${imageData ? " (with image)" : ""}`,
      timestamp: now,
    },
  });

  return announcementId;
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your administrator session has expired. Sign in again.");
  }
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error("Announcement ID is required.");

  const { id: _ignored, createdAt: _createdAt, ...updates } = data;
  await update(ref(database, `${ANNOUNCEMENTS_PATH}/${normalizedId}`), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteAnnouncement(id: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your administrator session has expired. Sign in again.");
  }
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error("Announcement ID is required.");

  const auditId = push(ref(database, AUDIT_LOGS_PATH)).key;
  if (!auditId) throw new Error("Unable to allocate an audit log ID.");

  const now = Date.now();
  await update(ref(database), {
    [`${ANNOUNCEMENTS_PATH}/${normalizedId}`]: null,
    [`${AUDIT_LOGS_PATH}/${auditId}`]: {
      action: "Announcement deleted",
      performedBy: currentUser.uid,
      details: normalizedId,
      timestamp: now,
    },
  });
}
