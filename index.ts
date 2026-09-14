export type AdminRole = "administrator" | "admin" | "staff" | "responder";
export type EmergencyPriority = "High" | "Medium" | "Low";
export type EmergencyStatus =
  | "Received"
  | "Responder Assigned"
  | "Responding"
  | "Resolved"
  | "Cancelled"
  | "ACTIVE"
  | string;

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface Emergency {
  id: string;
  userId: string;
  userName?: string;
  phone?: string;
  type: string;
  description: string;
  symptoms?: string;
  peopleInvolved?: number;
  location: GeoLocation;
  priority: EmergencyPriority;
  status: EmergencyStatus;
  assignedResponder?: string;
  responseNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  contactNumber?: string;
  address?: string;
  role?: string;
  profileImage?: string;
  qrCode?: string;
  status?: string;
  createdAt?: number;
}

export type ResponderStatus =
  | "Available"
  | "Assigned"
  | "Responding"
  | "Busy"
  | "Unavailable"
  | "Offline";

export interface Responder {
  id: string;
  name: string;
  email?: string;
  contact: string;
  address?: string;
  position?: string;
  status: ResponderStatus;
  createdAt?: number;
}

export type AnnouncementCategory =
  | "Barangay News"
  | "Health Advisory"
  | "Disease Outbreak Alert"
  | "Disaster Warning"
  | "Weather Advisory"
  | "Vaccination Campaign"
  | "Community Event";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  createdBy?: string;
  createdAt: number;
}

export interface HealthProfile {
  userId: string;
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
  details?: string;
  timestamp?: number;
  createdAt?: number;
}
