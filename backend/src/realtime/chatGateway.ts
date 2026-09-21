import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { setIO } from "./io";

export function initChatGateway(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });
  setIO(io);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthorized"));
      const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing", (payload: { conversationId: string }) => {
      socket.to(`conversation:${payload.conversationId}`).emit("typing", { userId });
    });

    socket.on(
      "message:send",
      async (payload: { conversationId: string; text?: string; attachmentUrl?: string }, ack) => {
        const conversation = await prisma.conversation.findUnique({ where: { id: payload.conversationId } });
        if (!conversation || (conversation.customerId !== userId && conversation.taskerId !== userId)) {
          return ack?.({ error: "Kein Zugriff auf diese Unterhaltung" });
        }
        const message = await prisma.message.create({
          data: {
            conversationId: payload.conversationId,
            senderId: userId,
            text: payload.text,
            attachmentUrl: payload.attachmentUrl,
          },
          include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        });
        io.to(`conversation:${payload.conversationId}`).emit("message:new", message);
        ack?.({ message });
      },
    );
  });

  return io;
}
