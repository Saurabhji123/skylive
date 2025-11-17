import { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { sendError } from "../utils/responses";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next;
  if (err instanceof HttpError) {
    return sendError(res, err.message, err.status, err.code);
  }

  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = err.code === "LIMIT_FILE_SIZE" ? "File too large" : err.message;
    return sendError(res, message, status, err.code);
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue?.message ?? "Request payload validation failed";
    return sendError(res, message, 400, "VALIDATION_ERROR");
  }

  console.error("Unexpected error", err);
  return sendError(res, "Internal server error", 500, "INTERNAL_ERROR");
};
