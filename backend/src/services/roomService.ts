import { randomBytes, createHash } from "crypto";
import { ObjectId } from "mongodb";
import { env } from "../config/env";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import { forbidden, notFound } from "../utils/errors";
import type {
  RefreshTokenDocument,
  RoomDocument,
  RtcSessionDocument,
  ScreenShareSessionDocument
} from "../types";
import { releaseTurnAllocation } from "./turnService";

export interface CreateRoomParams {
  hostId: string;
  name: string;
  isPrivate: boolean;
  password?: string;
  maxParticipants: number;
  allowReactions: boolean;
}

export interface JoinRoomParams {
  roomId: string;
  userId: string;
  password?: string;
}

export function generateRoomCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function mapRoom(room: RoomDocument): RoomDocument {
  return {
    ...room,
    id: room._id.toHexString(),
    sessionCount: room.sessionCount ?? 0
  };
}

export async function createRoom(params: CreateRoomParams): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);

  const roomObjectId = new ObjectId();
  const roomCode = generateRoomCode();
  const room: RoomDocument = {
    _id: roomObjectId,
    id: roomObjectId.toHexString(),
    roomCode,
    joinLink: `${env.CLIENT_ORIGIN}/join/${roomCode}`,
    status: "pending",
    hostId: params.hostId,
    settings: {
      maxParticipants: params.maxParticipants,
      allowPassword: params.isPrivate,
      allowReactions: params.allowReactions
    },
    createdAt: new Date().toISOString(),
    isLocked: false,
    guestIds: [],
    sessionCount: 0
  } as unknown as RoomDocument;

  if (params.isPrivate && params.password) {
    room.passwordHash = hashPassword(params.password);
  }

  await rooms.insertOne(room);
  return mapRoom(room);
}

export interface GetRoomsForHostOptions {
  limit?: number;
}

export async function getRoomsForHost(hostId: string, options: GetRoomsForHostOptions = {}): Promise<RoomDocument[]> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const { limit } = options;

  let cursor = rooms.find({ hostId }).sort({ createdAt: -1 });
  if (typeof limit === "number" && limit > 0) {
    cursor = cursor.limit(limit);
  }

  const docs = await cursor.toArray();

  return docs.map(mapRoom);
}

export async function getRoomById(roomId: string): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const room = await rooms.findOne({ _id: new ObjectId(roomId) });
  if (!room) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }
  return mapRoom(room);
}

export async function getRoomByCode(roomCode: string): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const room = await rooms.findOne({ roomCode });
  if (!room) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }
  return mapRoom(room);
}

export async function joinRoom(params: JoinRoomParams): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const roomObjectId = new ObjectId(params.roomId);
  const room = await rooms.findOne({ _id: roomObjectId });

  if (!room) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }

  if (room.status === "ended") {
    throw forbidden("Room has ended", "ROOM_ENDED");
  }

  if (room.status === "suspended") {
    throw forbidden("Room has been suspended by the host", "ROOM_SUSPENDED");
  }

  if (room.settings.maxParticipants <= room.guestIds.length + 1) {
    throw forbidden("Room is full", "ROOM_FULL");
  }

  if (room.passwordHash) {
    const providedHash = params.password ? hashPassword(params.password) : "";
    if (providedHash !== room.passwordHash) {
      throw forbidden("Incorrect room password", "ROOM_PASSWORD_INVALID");
    }
  }

  if (!room.guestIds.includes(params.userId)) {
    await rooms.updateOne({ _id: roomObjectId }, { $addToSet: { guestIds: params.userId } });
    room.guestIds.push(params.userId);
  }

  return mapRoom(room);
}

export async function lockRoom(roomId: string): Promise<void> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const result = await rooms.updateOne({ _id: new ObjectId(roomId) }, { $set: { isLocked: true } });
  if (!result.matchedCount) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }
}

export async function endRoom(roomId: string, endedBy: string): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const roomObjectId = new ObjectId(roomId);
  const room = await rooms.findOne({ _id: roomObjectId });

  if (!room) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }

  if (room.hostId !== endedBy) {
    throw forbidden("Only the host can end this room", "NOT_ROOM_HOST");
  }

  if (room.status === "ended") {
    return mapRoom(room);
  }

  const endedAt = new Date().toISOString();

  await rooms.updateOne(
    { _id: roomObjectId },
    {
      $set: {
        status: "ended",
        endedAt,
        presence: []
      },
      $unset: {
        activeRtcSessionId: ""
      }
    }
  );

  const sessions = db.collection<RtcSessionDocument>(COLLECTIONS.RTC_SESSIONS);
  const activeSessions = await sessions
    .find({ roomId, endTime: { $exists: false } })
    .project<{ _id: ObjectId }>({ _id: 1 })
    .toArray();

  if (activeSessions.length) {
    await sessions.updateMany(
      { _id: { $in: activeSessions.map((session) => session._id) } },
      { $set: { endTime: new Date() } }
    );

    const screenShareSessions = db.collection<ScreenShareSessionDocument>(COLLECTIONS.SCREEN_SHARE_SESSIONS);
    await screenShareSessions.updateMany(
      {
        rtcSessionId: { $in: activeSessions.map((session) => session._id.toHexString()) },
        endTime: { $exists: false }
      },
      { $set: { endTime: new Date() } }
    );
  }

  const resolvedRoomId = room._id.toHexString();

  await releaseTurnAllocation(resolvedRoomId);

  const refreshTokens = db.collection<RefreshTokenDocument>(COLLECTIONS.REFRESH_TOKENS);
  await refreshTokens.deleteMany({
    userId: { $in: [room.hostId, ...(room.guestIds ?? [])] },
    expiresAt: { $lt: new Date() }
  });

  const updated = await rooms.findOne({ _id: roomObjectId });
  if (!updated) {
    throw notFound("Room not found after update", "ROOM_NOT_FOUND_AFTER_UPDATE");
  }

  return mapRoom(updated);
}

export async function activateRoom(roomId: string, hostId: string): Promise<RoomDocument> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const roomObjectId = new ObjectId(roomId);
  const room = await rooms.findOne({ _id: roomObjectId });

  if (!room) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }

  if (room.hostId !== hostId) {
    throw forbidden("Only the host can activate this room", "NOT_ROOM_HOST");
  }

  if (room.status === "suspended") {
    throw forbidden("Room has been suspended", "ROOM_SUSPENDED");
  }

  const now = new Date().toISOString();
  const nextSessionCount = room.status === "live" ? room.sessionCount ?? 0 : (room.sessionCount ?? 0) + 1;
  const nextActiveSession =
    room.activeRtcSessionId && room.status === "live" ? room.activeRtcSessionId : randomBytes(12).toString("hex");

  await rooms.updateOne(
    { _id: roomObjectId },
    {
      $set: {
        status: "live",
        lastActivatedAt: now,
        sessionCount: nextSessionCount,
        activeRtcSessionId: nextActiveSession
      }
    }
  );

  const updated = await rooms.findOne({ _id: roomObjectId });
  if (!updated) {
    throw notFound("Room not found after activation", "ROOM_NOT_FOUND_AFTER_UPDATE");
  }

  return mapRoom(updated);
}

export async function suspendRoom(roomId: string, hostId: string): Promise<RoomDocument> {
  await endRoom(roomId, hostId);

  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const roomObjectId = new ObjectId(roomId);

  await rooms.updateOne(
    { _id: roomObjectId },
    {
      $set: {
        status: "suspended",
        deletedAt: new Date().toISOString()
      }
    }
  );

  const updated = await rooms.findOne({ _id: roomObjectId });
  if (!updated) {
    throw notFound("Room not found after suspension", "ROOM_NOT_FOUND_AFTER_UPDATE");
  }

  return mapRoom(updated);
}

export async function cleanupStaleRoomArtifacts(staleAfterMs = 1000 * 60 * 60): Promise<{
  rooms: number;
  sessions: number;
  shares: number;
  tokens: number;
}> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const sessions = db.collection<RtcSessionDocument>(COLLECTIONS.RTC_SESSIONS);
  const screenShares = db.collection<ScreenShareSessionDocument>(COLLECTIONS.SCREEN_SHARE_SESSIONS);
  const refreshTokens = db.collection<RefreshTokenDocument>(COLLECTIONS.REFRESH_TOKENS);

  const cutoffIso = new Date(Date.now() - staleAfterMs).toISOString();
  const staleRooms = await rooms
    .find({ status: "ended", endedAt: { $lt: cutoffIso } })
    .project<{ id?: string; _id: ObjectId }>({ id: 1 })
    .toArray();

  let sessionUpdates = 0;
  let shareUpdates = 0;

  for (const staleRoom of staleRooms) {
    const roomKey = staleRoom.id ?? staleRoom._id.toHexString();

    const activeSessions = await sessions
      .find({ roomId: roomKey, endTime: { $exists: false } })
      .project<{ _id: ObjectId }>({ _id: 1 })
      .toArray();

    if (activeSessions.length) {
      const sessionResult = await sessions.updateMany(
        { _id: { $in: activeSessions.map((session) => session._id) } },
        { $set: { endTime: new Date() } }
      );
      sessionUpdates += sessionResult.modifiedCount ?? 0;

      const shareResult = await screenShares.updateMany(
        {
          rtcSessionId: { $in: activeSessions.map((session) => session._id.toHexString()) },
          endTime: { $exists: false }
        },
        { $set: { endTime: new Date() } }
      );
      shareUpdates += shareResult.modifiedCount ?? 0;
    }

    await releaseTurnAllocation(roomKey);
  }

  const tokenResult = await refreshTokens.deleteMany({ expiresAt: { $lt: new Date() } });

  return {
    rooms: staleRooms.length,
    sessions: sessionUpdates,
    shares: shareUpdates,
    tokens: tokenResult.deletedCount ?? 0
  };
}
