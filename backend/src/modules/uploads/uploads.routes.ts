import { randomUUID } from "crypto";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../common/auth";
import { env } from "../../config/env";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const uploadsRouter = Router();

uploadsRouter.post("/", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Keine Datei erhalten" });
    return;
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});
