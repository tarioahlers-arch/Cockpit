import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";

export const supportRouter = Router();

const ticketSchema = z.object({
  subject: z.string().min(3).max(150),
  message: z.string().min(5).max(4000),
});

supportRouter.post(
  "/",
  requireAuth,
  validateBody(ticketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.create({ data: { ...req.body, userId: req.userId as string } });
    res.status(201).json({ ticket });
  }),
);

supportRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tickets = await prisma.supportTicket.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
    res.json({ tickets });
  }),
);

export const reportsRouter = Router();

const reportSchema = z.object({
  reportedUserId: z.string().min(1),
  reason: z.string().min(3).max(1000),
});

reportsRouter.post(
  "/",
  requireAuth,
  validateBody(reportSchema),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.create({ data: { reporterId: req.userId as string, ...req.body } });
    res.status(201).json({ report });
  }),
);
