import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().optional(),
});

export const taskerOnboardingSchema = z.object({
  hourlyRate: z.number().int().min(0),
  radiusKm: z.number().int().min(1).max(200),
  categoryIds: z.array(z.string()).min(1, "Waehle mindestens eine Kategorie"),
  bio: z.string().max(1000).optional(),
});
