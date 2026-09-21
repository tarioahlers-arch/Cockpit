import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";
import { badRequest } from "./errors";

export const validateBody = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(badRequest("Ungueltige Eingabe", result.error.flatten()));
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(badRequest("Ungueltige Query-Parameter", result.error.flatten()));
  }
  (req as unknown as { validatedQuery: unknown }).validatedQuery = result.data;
  next();
};
