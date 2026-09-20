import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAdmin, requireAuth } from "../../common/auth";
import { notFound } from "../../common/errors";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";
import { publicUser } from "../users/users.dto";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [totalJobs, completedTasks, tasksInProgress, totalUsers, openTickets] = await Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { status: "COMPLETED" } }),
      prisma.task.count({ where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } } }),
      prisma.user.count(),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
    ]);
    res.json({ totalJobs, completedTasks, tasksInProgress, totalUsers, openTickets });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) ?? "";
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ users: users.map(publicUser) });
  }),
);

adminRouter.patch(
  "/users/:id/block",
  validateBody(z.object({ isBlocked: z.boolean() })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound("Benutzer");
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isBlocked: req.body.isBlocked } });
    res.json({ user: publicUser(updated) });
  }),
);

adminRouter.get(
  "/support-tickets",
  asyncHandler(async (_req, res) => {
    const tickets = await prisma.supportTicket.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ tickets });
  }),
);

adminRouter.patch(
  "/support-tickets/:id",
  validateBody(z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]) })),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ ticket });
  }),
);

adminRouter.get(
  "/reports",
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        reportedUser: { select: { id: true, firstName: true, lastName: true, isBlocked: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reports });
  }),
);

adminRouter.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const tasks = await prisma.task.findMany({
      where: status ? { status: status as never } : undefined,
      include: { poster: { select: { firstName: true, lastName: true } }, category: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ tasks });
  }),
);
