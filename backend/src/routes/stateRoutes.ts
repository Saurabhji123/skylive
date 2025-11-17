import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/responses";
import { updateRoomPresence, getRoomState } from "../services/stateService";
import { badRequest } from "../utils/errors";

const presenceSchema = z.object({
  roomId: z.string(),
  participants: z
    .array(
      z.object({
        userId: z.string(),
        username: z.string(),
        status: z.enum(["online", "connecting", "disconnected"]),
        lastHeartbeat: z.number()
      })
    )
    .max(4)
});

export const stateRouter = Router();

stateRouter.post(
  "/participants",
  asyncHandler(async (req, res) => {
    const body = presenceSchema.parse(req.body);
    await updateRoomPresence(body.roomId, body.participants);
    sendSuccess(res, { updated: true });
  })
);

stateRouter.get(
  "/rooms/:roomId",
  asyncHandler(async (req, res) => {
    const { roomId } = req.params;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }

    const state = await getRoomState(roomId);
    sendSuccess(res, state);
  })
);

stateRouter.post(
  "/presence",
  asyncHandler(async (req, res) => {
    const body = presenceSchema.parse(req.body);
    await updateRoomPresence(body.roomId, body.participants);
    sendSuccess(res, { updated: true });
  })
);
