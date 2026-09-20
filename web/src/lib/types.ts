export type TaskStatus = "POSTED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type PaymentStatus = "PENDING" | "PAID" | "RELEASED" | "REFUNDED";
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  hourlyRate?: number | null;
  radiusKm?: number | null;
  emailVerified: boolean;
  isTaskerOnboarded: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  createdAt: string;
  updatedAt: string;
  skills?: Category[];
}

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category?: Category;
  city: string;
  address?: string | null;
  budgetCents: number;
  currency: string;
  status: TaskStatus;
  posterId: string;
  poster?: User;
  assignedTaskerId?: string | null;
  assignedTasker?: User | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
  applications?: Application[];
  invitations?: Invitation[];
}

export interface Application {
  id: string;
  taskId: string;
  taskerId: string;
  tasker?: User;
  message?: string | null;
  proposedCents?: number | null;
  status: ApplicationStatus;
  createdAt: string;
  task?: Task;
}

export interface Invitation {
  id: string;
  taskId: string;
  task?: Task;
  taskerId: string;
  tasker?: User;
  status: InvitationStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  text?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export interface Conversation {
  id: string;
  taskId: string;
  task?: { id: string; title: string; status: TaskStatus };
  customer?: User;
  tasker?: User;
  messages?: Message[];
}

export interface Payment {
  id: string;
  taskId: string;
  status: PaymentStatus;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  user?: User;
  subject: string;
  message: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporter?: User;
  reportedUserId: string;
  reportedUser?: User;
  reason: string;
  createdAt: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  isAnonymous: boolean;
  createdAt: string;
  reviewer?: User | null;
  task?: { id: string; title: string };
}

export const GERMAN_CITIES = [
  "Berlin",
  "Hamburg",
  "München",
  "Köln",
  "Frankfurt am Main",
  "Stuttgart",
  "Düsseldorf",
  "Leipzig",
];
