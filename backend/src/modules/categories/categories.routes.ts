import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler";
import { prisma } from "../../config/prisma";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.json({ categories });
  }),
);
