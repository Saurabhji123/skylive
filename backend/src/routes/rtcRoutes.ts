import { Router } from "express";
import { randomBytes } from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";
import { sendSuccess } from "../utils/responses";
import { env } from "../config/env";

export const rtcRouter = Router();

rtcRouter.get(
  "/turn",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const iceServers: {
      urls: string | string[];
      username?: string;
      credential?: string;
    }[] = [{ urls: "stun:stun.l.google.com:19302" }];

    if (env.TURN_ENDPOINT) {
      const username = env.TURN_STATIC_USERNAME ?? randomBytes(8).toString("hex");
      const credential = env.TURN_STATIC_CREDENTIAL ?? randomBytes(16).toString("hex");
      iceServers.unshift({
        urls: [`turn:${env.TURN_ENDPOINT}`],
        username,
        credential
      });
    }

    sendSuccess(res, { iceServers });
  }
);
