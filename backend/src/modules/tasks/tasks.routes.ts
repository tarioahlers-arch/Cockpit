import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { badRequest, forbidden, notFound } from "../../common/errors";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";
import { createNotification } from "../notifications/notifications.service";
import {
  applyToTaskSchema,
  createTaskSchema,
  inviteToTaskSchema,
  respondInvitationSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from "./tasks.schema";

export const tasksRouter = Router();

const taskInclude = {
  category: true,
  poster: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
  assignedTasker: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, ratingAvg: true, ratingCount: true } },
  _count: { select: { applications: true } },
} as const;

tasksRouter.post(
  "/",
  requireAuth,
  validateBody(createTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.create({
      data: { ...req.body, posterId: req.userId as string },
      include: taskInclude,
    });
    res.status(201).json({ task });
  }),
);

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = taskListQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where = {
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.city ? { city: { contains: q.city, mode: "insensitive" as const } } : {}),
      ...(q.status ? { status: q.status as never } : { status: "POSTED" as never }),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: "insensitive" as const } },
              { description: { contains: q.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(q.minBudget || q.maxBudget
        ? {
            budgetCents: {
              ...(q.minBudget ? { gte: q.minBudget } : {}),
              ...(q.maxBudget ? { lte: q.maxBudget } : {}),
            },
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({ tasks, total, page, pageSize });
  }),
);

tasksRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const type = (req.query.type as string) ?? "posted";
    const userId = req.userId as string;

    if (type === "posted") {
      const tasks = await prisma.task.findMany({ where: { posterId: userId }, include: taskInclude, orderBy: { createdAt: "desc" } });
      return res.json({ tasks });
    }
    if (type === "in_progress") {
      const tasks = await prisma.task.findMany({
        where: { OR: [{ posterId: userId }, { assignedTaskerId: userId }], status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        include: taskInclude,
        orderBy: { createdAt: "desc" },
      });
      return res.json({ tasks });
    }
    if (type === "invites") {
      const invitations = await prisma.taskInvitation.findMany({
        where: { taskerId: userId, status: "PENDING" },
        include: { task: { include: taskInclude } },
        orderBy: { createdAt: "desc" },
      });
      return res.json({ invitations });
    }
    if (type === "applications") {
      const applications = await prisma.taskApplication.findMany({
        where: { taskerId: userId },
        include: { task: { include: taskInclude } },
        orderBy: { createdAt: "desc" },
      });
      return res.json({ applications });
    }
    if (type === "completed") {
      const tasks = await prisma.task.findMany({
        where: { OR: [{ posterId: userId }, { assignedTaskerId: userId }], status: "COMPLETED" },
        include: taskInclude,
        orderBy: { updatedAt: "desc" },
      });
      return res.json({ tasks });
    }
    throw badRequest("Unbekannter type Parameter");
  }),
);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        ...taskInclude,
        applications: { include: { tasker: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, ratingAvg: true, ratingCount: true, hourlyRate: true } } } },
        invitations: true,
      },
    });
    if (!task) throw notFound("Aufgabe");
    res.json({ task });
  }),
);

tasksRouter.patch(
  "/:id",
  requireAuth,
  validateBody(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann die Aufgabe bearbeiten");
    const updated = await prisma.task.update({ where: { id: req.params.id }, data: req.body, include: taskInclude });
    res.json({ task: updated });
  }),
);

tasksRouter.post(
  "/:id/apply",
  requireAuth,
  validateBody(applyToTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId === req.userId) throw badRequest("Du kannst dich nicht auf deine eigene Aufgabe bewerben");
    if (task.status !== "POSTED") throw badRequest("Diese Aufgabe akzeptiert keine Bewerbungen mehr");

    const application = await prisma.taskApplication.upsert({
      where: { taskId_taskerId: { taskId: task.id, taskerId: req.userId as string } },
      update: { message: req.body.message, proposedCents: req.body.proposedCents, status: "PENDING" },
      create: { taskId: task.id, taskerId: req.userId as string, message: req.body.message, proposedCents: req.body.proposedCents },
    });

    await createNotification(task.posterId, "NEW_APPLICATION", "Neue Bewerbung", `Jemand hat sich auf "${task.title}" beworben.`);
    res.status(201).json({ application });
  }),
);

tasksRouter.post(
  "/:id/applications/:appId/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann Bewerbungen annehmen");

    const application = await prisma.taskApplication.findUnique({ where: { id: req.params.appId } });
    if (!application || application.taskId !== task.id) throw notFound("Bewerbung");

    const [, updatedTask] = await prisma.$transaction([
      prisma.taskApplication.update({ where: { id: application.id }, data: { status: "ACCEPTED" } }),
      prisma.task.update({ where: { id: task.id }, data: { status: "ASSIGNED", assignedTaskerId: application.taskerId }, include: taskInclude }),
    ]);
    await prisma.taskApplication.updateMany({
      where: { taskId: task.id, id: { not: application.id }, status: "PENDING" },
      data: { status: "DECLINED" },
    });

    await prisma.conversation.upsert({
      where: { taskId_taskerId: { taskId: task.id, taskerId: application.taskerId } },
      update: {},
      create: { taskId: task.id, customerId: task.posterId, taskerId: application.taskerId },
    });

    await createNotification(application.taskerId, "APPLICATION_ACCEPTED", "Bewerbung angenommen!", `Du wurdest fuer "${task.title}" ausgewaehlt.`);
    res.json({ task: updatedTask });
  }),
);

tasksRouter.post(
  "/:id/invite",
  requireAuth,
  validateBody(inviteToTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann Helfer einladen");

    const invitation = await prisma.taskInvitation.upsert({
      where: { taskId_taskerId: { taskId: task.id, taskerId: req.body.taskerId } },
      update: { status: "PENDING" },
      create: { taskId: task.id, taskerId: req.body.taskerId },
    });

    await createNotification(req.body.taskerId, "TASK_INVITATION", "Neue Einladung", `Du wurdest zu "${task.title}" eingeladen.`);
    res.status(201).json({ invitation });
  }),
);

tasksRouter.post(
  "/:id/invitations/:invId/respond",
  requireAuth,
  validateBody(respondInvitationSchema),
  asyncHandler(async (req, res) => {
    const invitation = await prisma.taskInvitation.findUnique({ where: { id: req.params.invId }, include: { task: true } });
    if (!invitation || invitation.taskId !== req.params.id) throw notFound("Einladung");
    if (invitation.taskerId !== req.userId) throw forbidden();

    const status = req.body.accept ? "ACCEPTED" : "DECLINED";
    await prisma.taskInvitation.update({ where: { id: invitation.id }, data: { status } });

    if (req.body.accept) {
      await prisma.task.update({ where: { id: invitation.taskId }, data: { status: "ASSIGNED", assignedTaskerId: invitation.taskerId } });
      await prisma.conversation.upsert({
        where: { taskId_taskerId: { taskId: invitation.taskId, taskerId: invitation.taskerId } },
        update: {},
        create: { taskId: invitation.taskId, customerId: invitation.task.posterId, taskerId: invitation.taskerId },
      });
      await createNotification(invitation.task.posterId, "INVITATION_ACCEPTED", "Einladung angenommen", `Deine Einladung fuer "${invitation.task.title}" wurde angenommen.`);
    }

    res.json({ status });
  }),
);

tasksRouter.post(
  "/:id/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId && task.assignedTaskerId !== req.userId) throw forbidden();
    if (task.status !== "ASSIGNED") throw badRequest("Aufgabe muss zuerst zugewiesen sein");
    const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS" }, include: taskInclude });
    res.json({ task: updated });
  }),
);

tasksRouter.post(
  "/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann die Aufgabe als erledigt markieren");
    if (!["ASSIGNED", "IN_PROGRESS"].includes(task.status)) throw badRequest("Aufgabe kann in diesem Status nicht abgeschlossen werden");

    const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED" }, include: taskInclude });
    if (task.assignedTaskerId) {
      await createNotification(task.assignedTaskerId, "TASK_COMPLETED", "Aufgabe abgeschlossen", `"${task.title}" wurde als erledigt markiert.`);
    }
    res.json({ task: updated });
  }),
);

tasksRouter.post(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann die Aufgabe stornieren");
    const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "CANCELLED" }, include: taskInclude });
    res.json({ task: updated });
  }),
);
