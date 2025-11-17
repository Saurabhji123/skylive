import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/tokens";
import { unauthorized } from "../utils/errors";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "host" | "guest";
    roomId?: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.substring(7) : undefined;

  if (!token) {
    return next(unauthorized("Missing access token"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      ...(payload.roomId ? { roomId: payload.roomId } : {})
    };
    return next();
  } catch {
    return next(unauthorized("Invalid or expired access token"));
  }
}
