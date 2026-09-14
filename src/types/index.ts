export type AdminRole = "administrator" | "admin";

export type AccountStatus = "active" | "suspended" | "revoked" | "disabled";

export interface AdminProfile {
  uid: string;
  email: string;
  role: AdminRole;
  accountStatus: AccountStatus | string;
  fullName?: string;
  phone?: string;
  officeTitle?: string;
  department?: string;
  profileImageData?: string;
  profileImageMimeType?: "image/jpeg" | string;
  profileImageByteSize?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface AdminProfileUpdateInput {
  fullName: string;
  phone: string;
  officeTitle: string;
  department: string;
  profileImageData?: string | null;
  profileImageMimeType?: "image/jpeg" | null;
  profileImageByteSize?: number | null;
}

export interface User {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  contactNumber?: string;
  address?: string;
  assignedBarangayId?: string;
  barangayName?: string;
  householdId?: string;
  inhabitantId?: string;
  purokId?: string;
  purokLabel?: string;
  purokVerificationStatus?: "PENDING" | "VERIFIED" | string;
  role?: "user" | "responder" | "respondent_applicant" | string;
  profileImage?: string;
  qrCode?: string;
  status?: string;
  accountStatus?: AccountStatus | string;
  respondentInvitationKey?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type HouseholdStatus = "active" | "inactive" | "relocated";

export interface Household {
  id: string;
  householdName: string;
  householdHeadId?: string;
  householdHeadName?: string;
  barangayId: string;
  barangayName: string;
  city: string;
  purokId: string;
  address: string;
  landmark?: string;
  householdType?: string;
  tenureStatus?: string;
  unitNumber?: string;
  primaryContact: string;
  secondaryContact?: string;
  monthlyIncome?: number;
  qrCode: string;
  status: HouseholdStatus;
  memberCount?: number;
  createdBy?: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;
}

export type InhabitantStatus = "active" | "deceased" | "relocated";

export interface Inhabitant {
  id: string;
  householdId: string;
  fullName: string;
  birthDate?: string;
  sex?: string;
  civilStatus?: string;
  relationshipToHead: string;
  phone?: string;
  linkedUserUid?: string;
  isHouseholdHead: boolean;
  status: InhabitantStatus;
  medicalConditions?: string;
  medicalHistory?: string;
  pastTreatments?: string;
  emergencyNotes?: string;
  createdBy?: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt: number;
}

export interface HouseholdCorrectionRequest {
  id: string;
  ownerUid: string;
  requestId: string;
  requestedBy: string;
  householdId: string;
  inhabitantId?: string;
  message: string;
  status: "PENDING" | "RESOLVED" | "REJECTED" | string;
  createdAt: number;
  updatedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface IncidentAnalyticsRecord {
  id: string;
  barangayId: string;
  purokId: string;
  purokVerificationStatus?: "PENDING" | "VERIFIED" | string;
  latitude: number;
  longitude: number;
  type: string;
  priority: string;
  status: string;
  createdAt: number;
  updatedAt?: number;
  resolvedAt?: number;
}


export type RespondentApplicationStatus =
  | "pending_review"
  | "under_verification"
  | "additional_documents_required"
  | "approved"
  | "rejected"
  | "suspended"
  | "deactivated";

export interface ResponderApplicationDocument {
  type: "PROFILE_PHOTO" | "GOVERNMENT_ID" | "TRAINING_CERTIFICATE" | string;
  fileName?: string;
  mimeType?: string;
  base64Data: string;
  encodedBytes?: number;
  uploadedAt?: number;
}

export interface RespondentApplicationDocuments {
  profilePhoto?: ResponderApplicationDocument;
  governmentId?: ResponderApplicationDocument;
  trainingCertificate?: ResponderApplicationDocument;
}

export interface RespondentApplication {
  id: string;
  applicantUid: string;
  fullName: string;
  birthDate?: string;
  gender?: string;
  address: string;
  phone: string;
  email: string;
  barangayId: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  organization?: string;
  requestedRole: string;
  experience?: string;
  trainingSummary?: string;
  status: RespondentApplicationStatus;
  reviewMessage?: string;
  reviewedBy?: string;
  approvedRole?: string;
  assignedBarangayId?: string;
  serviceArea?: string;
  profilePhoto?: ResponderApplicationDocument;
  governmentId?: ResponderApplicationDocument;
  trainingCertificate?: ResponderApplicationDocument;
  submittedAt: number;
  updatedAt: number;
  reviewedAt?: number;
}

export type InvitationStatus = "INVITED" | "REGISTERED" | "SUSPENDED" | "REVOKED";

export interface RespondentInvitation {
  id: string;
  normalizedEmail: string;
  fullName: string;
  phone: string;
  position: string;
  assignedBarangayId: string;
  serviceArea?: string;
  status: InvitationStatus;
  registeredUid?: string;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
}

export type ResponderAvailability = "AVAILABLE" | "BUSY" | "OFF_DUTY";

export interface Responder {
  id: string;
  authUid: string;
  role: "responder";
  accountStatus: AccountStatus;
  name: string;
  email: string;
  contact: string;
  address?: string;
  position?: string;
  assignedBarangayId?: string;
  serviceArea?: string;
  availability: ResponderAvailability;
  status?: string;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Barangay {
  id: string;
  name: string;
  city?: string;
  province?: string;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type EmergencyContactCategory =
  | "BARANGAY_HALL"
  | "BARANGAY_CAPTAIN"
  | "BARANGAY_TANOD"
  | "HEALTH_CENTER"
  | "AMBULANCE"
  | "RESCUE_TEAM"
  | "POLICE"
  | "FIRE"
  | "DISASTER_OFFICE"
  | "HOSPITAL"
  | "RED_CROSS"
  | "WATER"
  | "ELECTRICITY"
  | "SOCIAL_WELFARE"
  | "OTHER";

export interface EmergencyDirectoryContact {
  id: string;
  shortName: string;
  organizationName: string;
  category: EmergencyContactCategory;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  active: boolean;
  displayOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type EmergencyPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EmergencyStatus =
  | "PENDING"
  | "ACCEPTED"
  | "RESPONDING"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "AGENCY_CONTACTED"
  | "RESCUE_IN_PROGRESS"
  | "REPORT_SUBMITTED"
  | "ADMIN_REVIEWED"
  | "CLOSED"
  | "CANCELLED";


export interface EmergencyPatientProfile {
  uid: string;
  fullName: string;
  email?: string;
  phone?: string;
  contactNumber?: string;
  profileImage?: string;
  address?: string;
  assignedBarangayId?: string;
  accountStatus?: string;
}

export interface EmergencyMedicalSummary {
  bloodType?: string;
  allergies?: string;
  conditions?: string;
  medicalConditions?: string;
  medicalConditionCodes?: string[];
  otherMedicalConditions?: string;
  medications?: string;
  emergencyNote?: string;
  updatedAt?: number;
}

export interface EmergencyLocationSummary {
  barangayId?: string;
  barangayName?: string;
  description?: string;
}

export interface EmergencyLocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  updatedAt: number;
  source?: "incident" | "live_location" | "legacy" | "missing";
}

export type ResponseTeamRole = "COORDINATOR" | "SUPPORTING";
export type ResponderResponseStatus =
  | "ACCEPTED"
  | "RESPONDING"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "AGENCY_CONTACTED"
  | "RESCUE_IN_PROGRESS"
  | "WITHDRAWN";

export interface EmergencyResponderResponse {
  responderUid: string;
  responderName?: string;
  teamRole: ResponseTeamRole;
  responseStatus: ResponderResponseStatus;
  acceptedAt: number;
  updatedAt: number;
  lastLocationUpdate?: number;
  notes?: string;
  backupRequested?: boolean;
  active: boolean;
  location?: EmergencyLocationPoint;
}

export interface Emergency {
  id: string;
  patientUid: string;
  userId: string;
  patientName?: string;
  userName?: string;
  patientPhone?: string;
  phone?: string;
  assignedBarangayId?: string;
  type: string;
  description: string;
  reportedUrgency?: string;
  urgencyReviewedBy?: string;
  urgencyReviewedAt?: number;
  urgencyReviewReason?: string;
  urgencyHistory?: Record<string, { previous: string; current: string; reason: string; actorUid: string; at: number }>;
  severity: EmergencyPriority;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  locationSummary: EmergencyLocationSummary;
  location: EmergencyLocationPoint;
  coordinatorResponderId?: string;
  responseNotes?: string;
  alertState?: string;
  alarmActive?: boolean;
  arrivalVerified?: boolean;
  arrivalVerifiedAt?: number;
  arrivalVerifiedBy?: string;
  adminAcknowledgedAt?: number;
  adminAcknowledgedBy?: string;
  adminAcknowledgedName?: string;
  adminAcknowledgementNotificationId?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  responders?: Record<string, EmergencyResponderResponse>;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  cancelledAt?: number;
  patientProfile?: EmergencyPatientProfile;
  medicalSummary?: EmergencyMedicalSummary;
  recipientCount?: number;
}

export type RescueClassification =
  | "FALSE_ALARM"
  | "NON_CRITICAL"
  | "CRITICAL"
  | "RESCUED_ON_SITE"
  | "TRANSPORTED_TO_HOSPITAL"
  | "REFERRED_TO_POLICE"
  | "REFERRED_TO_FIRE_DEPARTMENT"
  | "REFERRED_TO_BARANGAY"
  | "USER_CANCELLED"
  | "USER_NOT_FOUND";

export type RescueReviewStatus = "PENDING_REVIEW" | "APPROVED" | "RETURNED_FOR_CORRECTION" | "INVESTIGATION";

export interface IndividualRescueReport {
  responderUid: string;
  responderName?: string;
  teamRole: ResponseTeamRole;
  arrivalAt?: number;
  completedAt?: number;
  observedCondition: string;
  actionsPerformed: string;
  agenciesContacted?: string;
  transportDestination?: string;
  notes?: string;
  classificationRecommendation: RescueClassification;
  submittedAt: number;
  updatedAt: number;
}

export interface FinalRescueReport {
  incidentId: string;
  coordinatorUid: string;
  classification: RescueClassification;
  summary: string;
  submittedAt: number;
  updatedAt: number;
  reviewStatus: RescueReviewStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
}

export interface RescueReportBundle {
  incidentId: string;
  emergency?: Emergency;
  responders: Record<string, IndividualRescueReport>;
  final?: FinalRescueReport;
}

export type AnnouncementCategory =
  | "Barangay News"
  | "Health Advisory"
  | "Disease Outbreak Alert"
  | "Disaster Warning"
  | "Weather Advisory"
  | "Vaccination Campaign"
  | "Community Event";
export type AnnouncementStatus = "published" | "draft" | "archived";
export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  status: AnnouncementStatus;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  targetAudience: "all";
  imageData?: string;
  imageMimeType?: string;
}

export interface HealthProfile {
  userId: string;
  fullName?: string;
  birthDate?: string;
  bloodType?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
  emergencyNote?: string;
  doctorName?: string;
  doctorPhone?: string;
  medicalHistory?: string;
  updatedAt?: number;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy?: string;
  userId?: string;
  incidentId?: string;
  details?: string;
  timestamp?: number;
  createdAt?: number;
}
