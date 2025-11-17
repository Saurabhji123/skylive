import { Response } from "express";

interface ResponseShape<T> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  code?: string | undefined;
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const payload: ResponseShape<T> = {
    success: true,
    data
  };
  res.status(status).json(payload);
}

export function sendError(res: Response, error: string, status: number, code?: string): void {
  const payload: ResponseShape<never> = {
    success: false,
    error,
    code
  };
  res.status(status).json(payload);
}
