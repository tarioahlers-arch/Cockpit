import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { HttpError } from "./common/errors";
import { env } from "./config/env";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { reportsRouter, supportRouter } from "./modules/support/support.routes";
import { reviewsRouter } from "./modules/reviews/reviews.routes";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { uploadsRouter } from "./modules/uploads/uploads.routes";
import { usersRouter } from "./modules/users/users.routes";

fs.mkdirSync(env.uploadDir, { recursive: true });

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "helferhand-api" }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api", chatRouter);
app.use("/api", reviewsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/support", supportRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route nicht gefunden: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  console.error(err);
  res.status(500).json({ message: "Interner Serverfehler" });
});
