import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/responses";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";
import {
  createRoom,
  getRoomByCode,
  joinRoom,
  lockRoom,
  endRoom,
  getRoomsForHost,
  activateRoom,
  suspendRoom,
  JoinRoomParams,
  CreateRoomParams
} from "../services/roomService";
import { badRequest } from "../utils/errors";
import { RoomSummary, RoomStats } from "@skylive/shared";

const createRoomSchema = z.object({
  name: z.string().min(2),
  isPrivate: z.boolean().optional().default(false),
  password: z.string().min(4).optional(),
  maxParticipants: z.number().int().min(2).max(4).default(2),
  allowReactions: z.boolean().default(true)
});

const joinRoomSchema = z.object({
  username: z.string().min(2),
  password: z.string().optional()
});

export const roomRouter = Router();

roomRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const body = createRoomSchema.parse(req.body);
    const createParams: CreateRoomParams = {
      hostId: req.user.id,
      name: body.name,
      isPrivate: body.isPrivate ?? false,
      maxParticipants: body.maxParticipants,
      allowReactions: body.allowReactions
    };

    if (body.password) {
      createParams.password = body.password;
    }

    const room = await createRoom(createParams);

    sendSuccess(res, room, 201);
  })
);

roomRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const includeStatsParam = Array.isArray(req.query.includeStats)
      ? req.query.includeStats[0]
      : req.query.includeStats;

    let resolvedLimit = 12;
    if (typeof limitParam === "string") {
      const numericLimit = Number.parseInt(limitParam, 10);
      if (!Number.isNaN(numericLimit)) {
        resolvedLimit = numericLimit;
      }
    }

    if (resolvedLimit < 0) {
      resolvedLimit = 12;
    }
    const includeStats = includeStatsParam === "true";
    const fetchAll = includeStats || resolvedLimit === 0;

    let rooms: RoomSummary[] = [];
    let stats: RoomStats | undefined;

    if (fetchAll) {
      const allRooms = await getRoomsForHost(req.user.id);
      rooms = resolvedLimit > 0 ? allRooms.slice(0, resolvedLimit) : allRooms;
      if (includeStats) {
        stats = calculateRoomStats(allRooms);
      }
    } else {
      rooms = await getRoomsForHost(req.user.id, { limit: resolvedLimit });
    }

    sendSuccess(res, stats ? { rooms, stats } : { rooms });
  })
);

roomRouter.get(
  "/code/:roomCode",
  asyncHandler(async (req, res) => {
    const { roomCode } = req.params;
    if (!roomCode) {
      throw badRequest("Missing room code", "ROOM_CODE_REQUIRED");
    }
    const room = await getRoomByCode(roomCode.toUpperCase());
    sendSuccess(res, room);
  })
);

roomRouter.post(
  "/:roomId/join",
  asyncHandler(async (req, res) => {
    const roomId = req.params.roomId;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }
    const body = joinRoomSchema.parse(req.body);
    const joinParams: JoinRoomParams = { roomId, userId: body.username };
    if (body.password) {
      joinParams.password = body.password;
    }
    const room = await joinRoom(joinParams);
    sendSuccess(res, room);
  })
);

roomRouter.post(
  "/:roomId/lock",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (req.user?.role !== "host") {
      throw badRequest("Only host can lock room", "NOT_HOST");
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }

    await lockRoom(roomId);
    sendSuccess(res, { isLocked: true });
  })
);

roomRouter.post(
  "/:roomId/end",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const roomId = req.params.roomId;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }
    const user = req.user;
    if (user?.role !== "host") {
      throw badRequest("Only the host can end the room", "NOT_HOST");
    }

    const room = await endRoom(roomId, user.id);
    sendSuccess(res, { status: room.status, endedAt: room.endedAt });
  })
);

roomRouter.post(
  "/:roomId/activate",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }

    const room = await activateRoom(roomId, req.user.id);
    sendSuccess(res, { room });
  })
);

roomRouter.delete(
  "/:roomId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const roomId = req.params.roomId;
    if (!roomId) {
      throw badRequest("Missing room id", "ROOM_ID_REQUIRED");
    }

    const room = await suspendRoom(roomId, req.user.id);
    sendSuccess(res, { room });
  })
);

function calculateRoomStats(rooms: RoomSummary[]): RoomStats {
  return rooms.reduce<RoomStats>(
    (acc, room) => {
      if (room.status === "pending") acc.pending += 1;
      if (room.status === "live") acc.live += 1;
      if (room.status === "ended") acc.ended += 1;
      if (room.status === "suspended") acc.suspended += 1;
      acc.totalSessions += room.sessionCount ?? 0;
      acc.total += 1;
      return acc;
    },
    { total: 0, pending: 0, live: 0, ended: 0, suspended: 0, totalSessions: 0 }
  );
}
