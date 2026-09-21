// Shared TypeScript types mirroring docs/API_CONTRACT.md.
// Prices are always integer cents (EUR) on the wire.

export type TaskStatus = 'POSTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'RELEASED' | 'REFUNDED';
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  bio: string | null;
  hourlyRate: number | null;
  radiusKm: number | null;
  emailVerified: boolean;
  isTaskerOnboarded: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

// Public profile shape returned by GET /api/users/:id — a subset of User plus skills.
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  hourlyRate: number | null;
  isTaskerOnboarded: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  skills: Category[];
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
}

// Minimal user reference as embedded in task/application/invitation/message payloads.
export interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  ratingAvg?: number | null;
  ratingCount?: number;
}

export interface Application {
  id: string;
  taskId: string;
  taskerId: string;
  tasker?: UserRef;
  message: string | null;
  proposedCents: number | null;
  status: ApplicationStatus;
  createdAt: string;
}

export interface Invitation {
  id: string;
  taskId: string;
  taskerId: string;
  tasker?: UserRef;
  status: InvitationStatus;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category?: Category;
  city: string;
  address: string | null;
  budgetCents: number;
  currency: string;
  status: TaskStatus;
  posterId: string;
  poster?: UserRef;
  assignedTaskerId: string | null;
  assignedTasker?: UserRef | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
  applications?: Application[];
  invitations?: Invitation[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: UserRef;
  text: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  id: string;
  taskId: string;
  task: { id: string; title: string; status: TaskStatus };
  customer: UserRef;
  tasker: UserRef;
  messages: Message[]; // last message only, per contract
}

export interface Payment {
  id: string;
  taskId: string;
  status: PaymentStatus;
  amountCents: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
  reviewer: UserRef | null;
  task: { id: string; title: string };
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title?: string;
  body?: string;
  message?: string;
  data?: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportStatus;
  createdAt: string;
}

export interface ApiError {
  message: string;
  details?: unknown;
}
