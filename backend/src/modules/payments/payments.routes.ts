import { randomUUID } from "crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler";
import { requireAuth } from "../../common/auth";
import { badRequest, forbidden, notFound } from "../../common/errors";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { createNotification } from "../notifications/notifications.service";
import { isStripeConfigured, stripe } from "./stripe";

export const paymentsRouter = Router();

paymentsRouter.post(
  "/tasks/:id/create-intent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) throw notFound("Aufgabe");
    if (task.posterId !== req.userId) throw forbidden("Nur der Ersteller kann bezahlen");
    if (!["ASSIGNED", "IN_PROGRESS", "COMPLETED"].includes(task.status)) {
      throw badRequest("Aufgabe muss zuerst einem Helfer zugewiesen sein");
    }

    const platformFeeCents = Math.round((task.budgetCents * env.platformFeePercent) / 100);

    let clientSecret = `pi_test_secret_${randomUUID()}`;
    let paymentIntentId = `pi_test_${randomUUID()}`;

    if (isStripeConfigured && stripe) {
      const intent = await stripe.paymentIntents.create({
        amount: task.budgetCents,
        currency: task.currency.toLowerCase(),
        application_fee_amount: platformFeeCents,
        metadata: { taskId: task.id },
      });
      clientSecret = intent.client_secret ?? clientSecret;
      paymentIntentId = intent.id;
    }

    const payment = await prisma.payment.create({
      data: {
        taskId: task.id,
        amountCents: task.budgetCents,
        platformFeeCents,
        currency: task.currency,
        stripePaymentIntentId: paymentIntentId,
      },
    });

    res.status(201).json({ payment, clientSecret, testMode: !isStripeConfigured });
  }),
);

// In test mode there is no real webhook delivery, so the frontend calls this
// endpoint after a successful (simulated) checkout to mark the payment paid.
paymentsRouter.post(
  "/:id/confirm",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { task: true } });
    if (!payment) throw notFound("Zahlung");
    if (payment.task.posterId !== req.userId) throw forbidden();

    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
    if (payment.task.assignedTaskerId) {
      await createNotification(payment.task.assignedTaskerId, "PAYMENT_RECEIVED", "Zahlung eingegangen", `Die Zahlung fuer "${payment.task.title}" wurde hinterlegt.`);
    }
    res.json({ payment: updated });
  }),
);

paymentsRouter.post(
  "/connect/onboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fakeAccountId = `acct_test_${req.userId?.slice(0, 8)}`;
    await prisma.user.update({ where: { id: req.userId }, data: { stripeAccountId: fakeAccountId } });
    res.json({ connected: true, testMode: !isStripeConfigured });
  }),
);

paymentsRouter.post(
  "/payout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { taskId } = req.body as { taskId: string };
    const payment = await prisma.payment.findFirst({ where: { taskId }, orderBy: { createdAt: "desc" } });
    if (!payment) throw notFound("Zahlung");
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.assignedTaskerId !== req.userId) throw forbidden("Nur der zugewiesene Helfer kann eine Auszahlung anfordern");
    if (payment.status !== "PAID") throw badRequest("Zahlung wurde noch nicht bestaetigt");

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "RELEASED", stripeTransferId: `tr_test_${randomUUID()}` },
    });
    res.json({ payment: updated, payoutCents: payment.amountCents - payment.platformFeeCents });
  }),
);
