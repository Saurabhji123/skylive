import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/responses";
import { recordAnalytics, recordLog } from "../services/analyticsService";
import type { AnalyticsPayload } from "@skylive/shared";

const analyticsSchema = z.object({
  roomId: z.string(),
  framesDropped: z.number(),
  averageJitter: z.number(),
  reconnectCount: z.number(),
  watchDurationSeconds: z.number(),
  surveyScore: z.number().optional()
});

const logSchema = z.object({
  type: z.string(),
  roomId: z.string().optional(),
  userId: z.string().optional(),
  payload: z.record(z.string(), z.unknown())
});

export const analyticsRouter = Router();

analyticsRouter.post(
  "/session",
  asyncHandler(async (req, res) => {
    const body = analyticsSchema.parse(req.body) satisfies AnalyticsPayload;
    const { surveyScore, ...rest } = body;
    const analyticsPayload: AnalyticsPayload =
      surveyScore === undefined ? rest : { ...rest, surveyScore };
    await recordAnalytics(analyticsPayload);
    sendSuccess(res, { recorded: true }, 201);
  })
);

analyticsRouter.post(
  "/logs",
  asyncHandler(async (req, res) => {
    const body = logSchema.parse(req.body);
    await recordLog({
      type: body.type,
      roomId: body.roomId,
      userId: body.userId,
      payload: body.payload
    });
    sendSuccess(res, { recorded: true }, 201);
  })
);
