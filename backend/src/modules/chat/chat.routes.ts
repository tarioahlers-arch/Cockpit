import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { forbidden, notFound } from "../../common/errors";
import { prisma } from "../../config/prisma";

export const chatRouter = Router();

const participantSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;

chatRouter.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId as string;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ customerId: userId }, { taskerId: userId }] },
      include: {
        task: { select: { id: true, title: true, status: true } },
        customer: { select: participantSelect },
        tasker: { select: participantSelect },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ conversations });
  }),
);

chatRouter.get(
  "/conversations/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) throw notFound("Unterhaltung");
    if (conversation.customerId !== req.userId && conversation.taskerId !== req.userId) throw forbidden();

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: participantSelect } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages });
  }),
);

chatRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) throw notFound("Unterhaltung");
    if (conversation.customerId !== req.userId && conversation.taskerId !== req.userId) throw forbidden();

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.userId as string,
        text: req.body.text,
        attachmentUrl: req.body.attachmentUrl,
      },
      include: { sender: { select: participantSelect } },
    });
    res.status(201).json({ message });
  }),
);
