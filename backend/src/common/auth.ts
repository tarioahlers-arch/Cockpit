import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { forbidden, unauthorized } from "./errors";

export interface AuthPayload {
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ userId } satisfies AuthPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized());
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.userId = payload.userId;
    next();
  } catch {
    next(unauthorized("Token ungueltig oder abgelaufen"));
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(unauthorized());
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.isAdmin) return next(forbidden("Nur fuer Administratoren"));
  next();
}
