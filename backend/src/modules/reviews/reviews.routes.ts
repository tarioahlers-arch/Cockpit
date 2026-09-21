import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { badRequest, forbidden, notFound } from "../../common/errors";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";
import { createNotification } from "../notifications/notifications.service";

export const reviewsRouter = Router();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  isAnonymous: z.boolean().optional(),
});

reviewsRouter.post(
  "/tasks/:id/review",
  requireAuth,
  validateBody(reviewSchema),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.status !== "COMPLETED") throw badRequest("Bewertungen sind erst nach Abschluss der Aufgabe moeglich");

    const userId = req.userId as string;
    let revieweeId: string;
    if (task.posterId === userId) revieweeId = task.assignedTaskerId as string;
    else if (task.assignedTaskerId === userId) revieweeId = task.posterId;
    else throw forbidden("Nur Beteiligte koennen bewerten");

    const review = await prisma.review.upsert({
      where: { taskId_reviewerId: { taskId: task.id, reviewerId: userId } },
      update: { rating: req.body.rating, comment: req.body.comment, isAnonymous: !!req.body.isAnonymous },
      create: {
        taskId: task.id,
        reviewerId: userId,
        revieweeId,
        rating: req.body.rating,
        comment: req.body.comment,
        isAnonymous: !!req.body.isAnonymous,
      },
    });

    const agg = await prisma.review.aggregate({ where: { revieweeId }, _avg: { rating: true }, _count: true });
    await prisma.user.update({
      where: { id: revieweeId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
    });

    await createNotification(revieweeId, "NEW_REVIEW", "Neue Bewertung", `Du hast eine neue Bewertung fuer "${task.title}" erhalten.`);
    res.status(201).json({ review });
  }),
);
