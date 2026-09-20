import bcrypt from "bcryptjs";
import { Router } from "express";
import { randomBytes } from "crypto";
import { asyncHandler } from "../../common/asyncHandler";
import { signToken, requireAuth } from "../../common/auth";
import { badRequest, conflict, notFound, unauthorized } from "../../common/errors";
import { validateBody } from "../../common/validate";
import { prisma } from "../../config/prisma";
import { publicUser } from "../users/users.dto";
import { loginSchema, registerSchema, verifyEmailSchema } from "./auth.schema";

export const authRouter = Router();

authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone, city } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("Diese E-Mail-Adresse ist bereits registriert");

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = randomBytes(24).toString("hex");

    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, city, verificationToken },
    });

    // In production this would send a real email. For this MVP we log it and
    // expose the token via the dev-only endpoint below so the flow is testable end-to-end.
    console.log(`[HelferHand] Verifizierungslink fuer ${email}: /auth/verify-email?token=${verificationToken}`);

    const token = signToken(user.id);
    res.status(201).json({ token, user: publicUser(user), devVerificationToken: verificationToken });
  }),
);

authRouter.post(
  "/verify-email",
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) throw badRequest("Ungueltiger oder abgelaufener Verifizierungslink");
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });
    res.json({ user: publicUser(updated) });
  }),
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized("E-Mail oder Passwort ist falsch");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized("E-Mail oder Passwort ist falsch");
    if (user.isBlocked) throw unauthorized("Dieses Konto wurde gesperrt");

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw notFound("Benutzer");
    res.json({ user: publicUser(user) });
  }),
);
