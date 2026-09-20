import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  categoryId: z.string().min(1),
  city: z.string().min(1),
  address: z.string().optional(),
  budgetCents: z.number().int().min(500, "Mindestbudget sind 5 Euro"),
  scheduledAt: z.string().datetime().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const applyToTaskSchema = z.object({
  message: z.string().max(1000).optional(),
  proposedCents: z.number().int().min(0).optional(),
});

export const inviteToTaskSchema = z.object({
  taskerId: z.string().min(1),
});

export const respondInvitationSchema = z.object({
  accept: z.boolean(),
});

export const taskListQuerySchema = z.object({
  categoryId: z.string().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});
