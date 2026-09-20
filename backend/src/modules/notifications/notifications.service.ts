import { prisma } from "../../config/prisma";
import { getIO } from "../../realtime/io";

export async function createNotification(userId: string, type: string, title: string, body: string) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body },
  });
  try {
    getIO().to(`user:${userId}`).emit("notification", notification);
  } catch {
    // socket layer not ready (e.g. during tests) - ignore
  }
  return notification;
}
