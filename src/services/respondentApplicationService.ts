import { get, onValue, push, ref, update } from "firebase/database";
import { auth, database } from "../firebase/config";
import type {
  RespondentApplication,
  RespondentApplicationDocuments,
  RespondentApplicationStatus,
} from "../types";

function requireAdmin() {
  const actor = auth.currentUser;
  if (!actor) throw new Error("Your administrator session has expired.");
  return actor;
}

function normalized(value: unknown) {
  return String(value ?? "").trim();
}

export function listenRespondentApplications(
  callback: (items: RespondentApplication[]) => void,
) {
  return onValue(ref(database, "responderApplications"), (snapshot) => {
    const raw = snapshot.val() as Record<string, Omit<RespondentApplication, "id">> | null;
    const items = raw
      ? Object.entries(raw).map(([id, value]) => ({
          id,
          ...value,
          applicantUid: value.applicantUid || id,
          status: (normalized(value.status).toLowerCase() || "pending_review") as RespondentApplicationStatus,
        }))
      : [];
    items.sort((first, second) => (second.updatedAt || second.submittedAt || 0) - (first.updatedAt || first.submittedAt || 0));
    callback(items);
  });
}

export async function loadRespondentApplicationDocuments(
  applicantUid: string,
): Promise<RespondentApplicationDocuments> {
  const uid = normalized(applicantUid);
  if (!uid) throw new Error("The applicant UID is missing.");
  const snapshot = await get(
    ref(database, `responderApplicationDocuments/${uid}`),
  );
  return snapshot.exists()
    ? (snapshot.val() as RespondentApplicationDocuments)
    : {};
}

export interface ReviewRespondentApplicationInput {
  application: RespondentApplication;
  status: RespondentApplicationStatus;
  reviewMessage: string;
  approvedRole?: string;
  assignedBarangayId?: string;
  serviceArea?: string;
}

function notificationCopy(status: RespondentApplicationStatus, reviewMessage: string) {
  if (status === "approved") {
    return {
      title: "Responder application approved",
      message: reviewMessage || "Your HealthMate respondent account is active. Sign in to receive authorized emergency assignments.",
    };
  }
  if (status === "additional_documents_required") {
    return {
      title: "Respondent application update required",
      message: reviewMessage || "The administrator requested clearer or additional identity and training documents.",
    };
  }
  if (status === "under_verification") {
    return {
      title: "Respondent application under verification",
      message: reviewMessage || "Your identity and training documents are being verified.",
    };
  }
  if (status === "rejected") {
    return {
      title: "Respondent application not approved",
      message: reviewMessage || "Review the administrator note in HealthMate before deciding whether to resubmit.",
    };
  }
  if (status === "suspended") {
    return {
      title: "Respondent application suspended",
      message: reviewMessage || "Contact the HealthMate administrator for assistance.",
    };
  }
  return {
    title: "Respondent account deactivated",
    message: reviewMessage || "Your respondent access is no longer active.",
  };
}

export async function reviewRespondentApplication(
  input: ReviewRespondentApplicationInput,
) {
  const actor = requireAdmin();
  const application = input.application;
  const uid = normalized(application.applicantUid || application.id);
  if (!uid) throw new Error("The applicant UID is missing.");

  const status = normalized(input.status).toLowerCase() as RespondentApplicationStatus;
  const allowed: RespondentApplicationStatus[] = [
    "under_verification",
    "additional_documents_required",
    "approved",
    "rejected",
    "suspended",
    "deactivated",
  ];
  if (!allowed.includes(status)) throw new Error("Unsupported application review status.");

  const approvedRole = normalized(input.approvedRole || application.requestedRole);
  const assignedBarangayId = normalized(input.assignedBarangayId || application.barangayId);
  const serviceArea = normalized(input.serviceArea);
  const reviewMessage = normalized(input.reviewMessage);
  if (status === "approved" && !approvedRole) throw new Error("Select the approved responder role.");
  if (status === "approved" && !assignedBarangayId) throw new Error("Assign a barangay before approval.");
  if (["additional_documents_required", "rejected", "suspended", "deactivated"].includes(status) && !reviewMessage) {
    throw new Error("Enter an administrator review message.");
  }

  const documents = await loadRespondentApplicationDocuments(uid);
  if (status === "approved" && !documents.governmentId?.base64Data) {
    throw new Error("A government-issued ID image is required before approval.");
  }
  if (status === "approved" && !documents.trainingCertificate?.base64Data) {
    throw new Error("A training certificate image is required before approval.");
  }

  const now = Date.now();
  const notificationId = push(ref(database, "notificationRequests")).key;
  const auditId = push(ref(database, "auditLogs")).key;
  if (!notificationId || !auditId) throw new Error("Unable to allocate the review transaction records.");
  const copy = notificationCopy(status, reviewMessage);
  const previousStatus = normalized(application.status).toLowerCase() || "pending_review";
  const accountStatus = status === "approved" ? "active" : status;

  const updates: Record<string, unknown> = {
    [`responderApplications/${uid}/status`]: status,
    [`responderApplications/${uid}/reviewMessage`]: reviewMessage,
    [`responderApplications/${uid}/reviewedBy`]: actor.uid,
    [`responderApplications/${uid}/reviewedAt`]: now,
    [`responderApplications/${uid}/updatedAt`]: now,
    [`responderApplications/${uid}/approvedRole`]: status === "approved" ? approvedRole : null,
    [`responderApplications/${uid}/assignedBarangayId`]: status === "approved" ? assignedBarangayId : null,
    [`responderApplications/${uid}/serviceArea`]: status === "approved" ? serviceArea : null,
    [`users/${uid}/accountStatus`]: accountStatus,
    [`users/${uid}/status`]: accountStatus,
    [`users/${uid}/updatedAt`]: now,
    [`notificationRequests/${notificationId}`]: {
      targetUserId: uid,
      title: copy.title,
      message: copy.message,
      body: copy.message,
      type: `respondent_application_${status}`,
      priority: status === "approved" ? "HIGH" : "NORMAL",
      relatedEntityId: uid,
      createdBy: actor.uid,
      status: "queued",
      createdAt: now,
    },
    [`notifications/${uid}/${notificationId}`]: {
      title: copy.title,
      message: copy.message,
      body: copy.message,
      type: `respondent_application_${status}`,
      priority: status === "approved" ? "HIGH" : "NORMAL",
      relatedEntityId: uid,
      createdBy: actor.uid,
      createdAt: now,
      timestamp: now,
      read: false,
      readAt: 0,
    },
    [`auditLogs/${auditId}`]: {
      action: `Respondent application ${status.replace(/_/g, " ")}`,
      performedBy: actor.uid,
      userId: uid,
      details: `${application.fullName} (${application.email})`,
      previousStatus,
      newStatus: status,
      reviewMessage,
      timestamp: now,
    },
  };

  if (status === "approved") {
    updates[`users/${uid}/role`] = "responder";
    updates[`users/${uid}/fullName`] = application.fullName;
    updates[`users/${uid}/email`] = application.email;
    updates[`users/${uid}/phone`] = application.phone;
    updates[`users/${uid}/contactNumber`] = application.phone;
    updates[`users/${uid}/assignedBarangayId`] = assignedBarangayId;
    if (documents.profilePhoto?.base64Data) {
      updates[`users/${uid}/profileImage`] = documents.profilePhoto.base64Data;
    }
    updates[`respondents/${uid}`] = {
      authUid: uid,
      role: "responder",
      accountStatus: "active",
      status: "active",
      name: application.fullName,
      email: application.email,
      contact: application.phone,
      address: application.address,
      position: approvedRole,
      assignedBarangayId,
      serviceArea,
      availability: "OFF_DUTY",
      applicationId: uid,
      approvedBy: actor.uid,
      createdAt: application.submittedAt || now,
      updatedAt: now,
    };
    updates[`emergencyDispatchRecipients/responders/${uid}`] = {
      active: true,
      online: false,
      role: "responder",
      fullName: application.fullName,
      email: application.email,
      assignedBarangayId,
      availability: "OFF_DUTY",
      updatedAt: now,
    };
  } else {
    /*
     * Any non-approved application remains in the applicant shell. This also
     * safely removes respondent access when an already-approved account is
     * suspended, deactivated, rejected, or returned for new documents.
     */
    updates[`users/${uid}/role`] = "respondent_applicant";

    const wasPreviouslyApproved =
      previousStatus === "approved" || Boolean(application.approvedRole);

    if (wasPreviouslyApproved) {
      updates[`respondents/${uid}/accountStatus`] = accountStatus;
      updates[`respondents/${uid}/status`] = accountStatus;
      updates[`respondents/${uid}/updatedAt`] = now;
      updates[`emergencyDispatchRecipients/responders/${uid}/active`] = false;
      updates[`emergencyDispatchRecipients/responders/${uid}/online`] = false;
      updates[`emergencyDispatchRecipients/responders/${uid}/updatedAt`] = now;
    }
  }

  await update(ref(database), updates);
  return { uid, status, notificationId };
}
