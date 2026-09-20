import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { notFound } from "../../common/errors";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";
import { createNotification } from "../notifications/notifications.service";
import { publicProfile, publicUser } from "./users.dto";
import { taskerOnboardingSchema, updateProfileSchema } from "./users.schema";

export const usersRouter = Router();

usersRouter.patch(
  "/me",
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.userId }, data: req.body });
    res.json({ user: publicUser(user) });
  }),
);

usersRouter.post(
  "/me/tasker-onboarding",
  requireAuth,
  validateBody(taskerOnboardingSchema),
  asyncHandler(async (req, res) => {
    const { hourlyRate, radiusKm, categoryIds, bio } = req.body as {
      hourlyRate: number;
      radiusKm: number;
      categoryIds: string[];
      bio?: string;
    };

    await prisma.taskerSkill.deleteMany({ where: { userId: req.userId } });
    await prisma.taskerSkill.createMany({
      data: [...new Set(categoryIds)].map((categoryId) => ({ userId: req.userId as string, categoryId })),
    });

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { hourlyRate, radiusKm, isTaskerOnboarded: true, bio: bio ?? undefined },
    });

    await createNotification(
      user.id,
      "TASKER_ONBOARDED",
      "Willkommen als Helfer!",
      "Dein Helfer-Profil ist jetzt aktiv. Du kannst ab sofort Aufgaben annehmen.",
    );

    res.json({ user: publicUser(user) });
  }),
);

usersRouter.post(
  "/me/stripe-connect",
  requireAuth,
  asyncHandler(async (req, res) => {
    // Simulated Stripe Connect onboarding (test mode) - stores a fake connected account id
    // so payouts can be demoed without a real Stripe business account.
    const fakeAccountId = `acct_test_${req.userId?.slice(0, 8)}`;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { stripeAccountId: fakeAccountId },
    });
    res.json({ user: publicUser(user), onboardingUrl: null, connected: true });
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { skills: { include: { category: true } } },
    });
    if (!user) throw notFound("Benutzer");
    res.json({ user: { ...publicProfile(user), skills: user.skills.map((s) => s.category) } });
  }),
);

usersRouter.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { revieweeId: req.params.id },
      include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }, task: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        reviewer: r.isAnonymous ? null : r.reviewer,
      })),
    });
  }),
);
