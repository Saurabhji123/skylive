import { randomUUID } from "crypto";
import type { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import {
  SignalingEvent,
  HeartbeatPayload,
  ChatMessage,
  RoomEndRequestPayload,
  RoomEndedPayload,
  ScreenShareState,
  ParticipantsUpdatePayload,
  RoomParticipantSummary,
  ModerationActionPayload,
  WhiteboardStroke,
  WhiteboardStateSnapshot,
  WhiteboardTogglePayload,
  WhiteboardClearPayload,
  WhiteboardStrokePayload,
  WhiteboardPoint,
  ReactionEvent,
  ReactionSendPayload
} from "@skylive/shared";
import { recordHeartbeat, startScreenShareSession, stopScreenShareSession } from "../services/rtcService";
import { persistMessage } from "../services/messageService";
import { recordLog } from "../services/analyticsService";
import { endRoom, getRoomById } from "../services/roomService";

interface ConnectionMeta {
  userId: string;
  roomId: string;
  rtcSessionId?: string;
  screenShareSessionId?: string;
  displayName?: string;
}

interface JoinRoomPayload {
  roomId?: string;
  userId?: string;
  displayName?: string;
  reconnect?: boolean;
}

interface JoinRoomAck {
  ok: boolean;
  roomId?: string;
  reconnect?: boolean;
  heartbeatGraceMs: number;
  error?: string;
}

interface ParticipantSessionMeta {
  userId: string;
  socketId: string;
  displayName?: string;
  joinedAt: string;
}

const HEARTBEAT_GRACE_MS = 15000;
const heartbeatIntervals = new Map<string, NodeJS.Timeout>();
const roomParticipants = new Map<string, Map<string, ParticipantSessionMeta>>();
const roomPresenters = new Map<string, string>();
const roomHosts = new Map<string, string>();
const roomWhiteboards = new Map<string, MutableWhiteboardState>();
const roomMetadata = new Map<string, RoomRuntimeMeta>();

interface MutableWhiteboardState {
  active: boolean;
  strokes: WhiteboardStroke[];
  revision: number;
  updatedAt: string;
  presenterUserId?: string;
}

interface RoomRuntimeMeta {
  hostId: string;
  maxGuests: number;
}

const WHITEBOARD_MAX_STROKES = 400;

export function createSocketServer(server: HTTPServer): Server {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    const meta = extractMeta(socket);
    if (!meta) {
      socket.disconnect(true);
      return;
    }

    let joined = false;

    const joinWithAck = async (payload: JoinRoomPayload = {}, callback?: (ack: JoinRoomAck) => void) => {
      const targetRoom = typeof payload.roomId === "string" && payload.roomId.length ? payload.roomId : meta.roomId;
      const userId = typeof payload.userId === "string" && payload.userId.length ? payload.userId : meta.userId;

      if (!targetRoom || !userId) {
        const failure: JoinRoomAck = {
          ok: false,
          heartbeatGraceMs: HEARTBEAT_GRACE_MS,
          error: "ROOM_OR_USER_MISSING"
        };
        if (callback) callback(failure);
        socket.disconnect(true);
        return;
      }

      meta.roomId = targetRoom;
      meta.userId = userId;
      if (typeof payload.displayName === "string" && payload.displayName.length > 0) {
        meta.displayName = payload.displayName;
      }

      if (!joined) {
        await socket.join(targetRoom);
        joined = true;
      }

      const reconnecting = Boolean(payload.reconnect);

      const roomMeta = await ensureRoomMeta(targetRoom);
      if (!roomMeta) {
        const failure: JoinRoomAck = {
          ok: false,
          heartbeatGraceMs: HEARTBEAT_GRACE_MS,
          error: "ROOM_NOT_FOUND"
        };
        if (callback) callback(failure);
        socket.disconnect(true);
        return;
      }

      const hostId = roomMeta.hostId;
      const participants = getParticipantMap(targetRoom);
      const existingParticipant = participants.get(userId);
      const joinedAt = existingParticipant?.joinedAt ?? new Date().toISOString();
      const displayName = meta.displayName ?? existingParticipant?.displayName ?? userId;

      if (!existingParticipant) {
        const isHostJoining = hostId === userId;
        const maxGuests = roomMeta.maxGuests;
        if (!isHostJoining && Number.isFinite(maxGuests)) {
          const hostPresent = hostId ? participants.has(hostId) : false;
          const activeGuests = participants.size - (hostPresent ? 1 : 0);
          if (activeGuests >= maxGuests) {
            const failure: JoinRoomAck = {
              ok: false,
              heartbeatGraceMs: HEARTBEAT_GRACE_MS,
              error: "ROOM_AT_CAPACITY"
            };
            if (callback) callback(failure);
            return;
          }
        }
      }
      participants.set(userId, {
        userId,
        socketId: socket.id,
        displayName,
        joinedAt
      });

      if (!roomPresenters.has(targetRoom)) {
        const defaultPresenter = hostId && participants.has(hostId) ? hostId : userId;
        roomPresenters.set(targetRoom, defaultPresenter);
      }

      socket.to(targetRoom).emit("user_joined", {
        userId,
        displayName: meta.displayName,
        reconnect: reconnecting
      });

      await recordLog({
        type: "socket:join",
        roomId: targetRoom,
        userId,
        payload: { socketId: socket.id, reconnecting }
      });

      broadcastParticipants(io, targetRoom);

      const success: JoinRoomAck = {
        ok: true,
        roomId: targetRoom,
        reconnect: reconnecting,
        heartbeatGraceMs: HEARTBEAT_GRACE_MS
      };
      if (callback) callback(success);
    };

    void socket.emit("connected", { roomId: meta.roomId });

    socket.on("join_room", (payload: JoinRoomPayload = {}, callback?: (ack: JoinRoomAck) => void) => {
      void joinWithAck(payload, callback);
    });

    socket.on("signal", async (event: SignalingEvent & { to?: string }) => {
      if (!joined) {
        return;
      }
      if (event.type === "heartbeat") {
        await handleHeartbeat(meta, event.payload, socket);
        return;
      }

      if (event.type === "share-started") {
        await handleScreenShareStart(meta, event.payload);
      }

      if (event.type === "share-stopped") {
        await handleScreenShareStop(meta);
      }

      if (event.to) {
        io.to(event.to).emit("signal", { ...event, from: socket.id });
      } else {
        socket.to(meta.roomId).emit("signal", { ...event, from: socket.id });
      }
    });

    socket.on(
      "chat:message",
      async (message: ChatMessage, callback?: (ack: { ok: boolean; id: string }) => void) => {
        if (!joined) {
          return;
        }

        try {
          await persistMessage(message);
          io.to(meta.roomId).emit("chat:message", message);
          callback?.({ ok: true, id: message.id });
        } catch (error) {
          console.error("Failed to persist chat message", error);
          callback?.({ ok: false, id: message.id });
        }
      }
    );

    socket.on(
      "room:end",
      async (payload: RoomEndRequestPayload, callback?: (ack: { ok: boolean; error?: string }) => void) => {
        if (!joined) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const roomId = meta.roomId;
        if (!roomId) {
          callback?.({ ok: false, error: "ROOM_ID_MISSING" });
          return;
        }

        try {
          const room = await endRoom(roomId, meta.userId);
          await recordLog({
            type: "room:end",
            roomId,
            userId: meta.userId,
            payload: { reason: payload?.reason ?? null }
          });

          const broadcast: RoomEndedPayload = {
            roomId: room.id ?? roomId,
            endedBy: meta.userId,
            endedAt: room.endedAt ?? new Date().toISOString()
          };

          if (payload?.reason) {
            broadcast.reason = payload.reason;
          }

          io.to(roomId).emit("room:ended", broadcast);
          callback?.({ ok: true });
        } catch (error) {
          console.error("Failed to end room", { roomId, error });
          const message = error instanceof Error ? error.message : "ROOM_END_FAILED";
          callback?.({ ok: false, error: message });
        }
      }
    );

    socket.on(
      "moderation:action",
      async (action: ModerationActionPayload, callback?: (ack: { ok: boolean; error?: string }) => void) => {
        if (!joined) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const roomId = meta.roomId;
        if (!roomId) {
          callback?.({ ok: false, error: "ROOM_ID_MISSING" });
          return;
        }

        if (!action || typeof action.targetUserId !== "string" || !action.targetUserId.length) {
          callback?.({ ok: false, error: "TARGET_REQUIRED" });
          return;
        }

        const hostId = await ensureHostId(roomId);
        if (!hostId || hostId !== meta.userId) {
          callback?.({ ok: false, error: "NOT_HOST" });
          return;
        }

        const participants = roomParticipants.get(roomId);
        if (!participants) {
          callback?.({ ok: false, error: "NO_PARTICIPANTS" });
          return;
        }

        const target = participants.get(action.targetUserId);
        if (!target) {
          callback?.({ ok: false, error: "TARGET_NOT_FOUND" });
          return;
        }

        if (action.targetUserId === hostId) {
          callback?.({ ok: false, error: "CANNOT_TARGET_HOST" });
          return;
        }

        if (action.type === "mute") {
          io.to(target.socketId).emit("moderation:force-mute", {
            by: meta.userId,
            reason: action.reason ?? null
          });
          callback?.({ ok: true });
          return;
        }

        if (action.type === "block") {
          io.to(target.socketId).emit("moderation:kick", {
            by: meta.userId,
            reason: action.reason ?? null
          });
          removeParticipant(roomId, action.targetUserId);
          broadcastParticipants(io, roomId);
          const targetSocket = io.sockets.sockets.get(target.socketId);
          targetSocket?.disconnect(true);
          callback?.({ ok: true });
          return;
        }

        if (action.type === "presenter") {
          roomPresenters.set(roomId, action.targetUserId);
          broadcastParticipants(io, roomId);
          callback?.({ ok: true });
          return;
        }

        callback?.({ ok: false, error: "UNKNOWN_ACTION" });
      }
    );

    socket.on(
      "whiteboard:sync",
      (callback?: (ack: { ok: boolean; state?: WhiteboardStateSnapshot; error?: string }) => void) => {
        if (!joined || !meta.roomId) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const state = getWhiteboardState(meta.roomId);
        callback?.({ ok: true, state: toWhiteboardSnapshot(meta.roomId, state) });
      }
    );

    socket.on(
      "whiteboard:toggle",
      async (payload: WhiteboardTogglePayload, callback?: (ack: { ok: boolean; error?: string; state?: WhiteboardStateSnapshot }) => void) => {
        if (!joined || !meta.roomId) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const roomId = meta.roomId;
        const hostId = await ensureHostId(roomId);
        if (!hostId || hostId !== meta.userId) {
          callback?.({ ok: false, error: "NOT_HOST" });
          return;
        }

        const nextActive = Boolean(payload?.active);
        const state = getWhiteboardState(roomId);
        state.active = nextActive;
        state.updatedAt = new Date().toISOString();
        state.revision += 1;
        if (nextActive) {
          state.presenterUserId = meta.userId;
        } else {
          delete state.presenterUserId;
        }

        const snapshot = toWhiteboardSnapshot(roomId, state);
        io.to(roomId).emit("whiteboard:toggle", { state: snapshot, by: meta.userId });
        callback?.({ ok: true, state: snapshot });
      }
    );

    socket.on(
      "whiteboard:stroke",
      (payload: WhiteboardStrokePayload, callback?: (ack: { ok: boolean; error?: string; revision?: number }) => void) => {
        if (!joined || !meta.roomId) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const roomId = meta.roomId;
        if (!canAnnotate(roomId, meta.userId)) {
          callback?.({ ok: false, error: "NOT_ALLOWED" });
          return;
        }

        const stroke = normalizeStroke(payload?.stroke, roomId, meta.userId);
        if (!stroke.points.length) {
          callback?.({ ok: false, error: "EMPTY_STROKE" });
          return;
        }

        const state = getWhiteboardState(roomId);
        state.strokes.push(stroke);
        if (state.strokes.length > WHITEBOARD_MAX_STROKES) {
          state.strokes.splice(0, state.strokes.length - WHITEBOARD_MAX_STROKES);
        }
        state.updatedAt = new Date().toISOString();
        state.revision += 1;

        io.to(roomId).emit("whiteboard:stroke", { stroke, revision: state.revision });
        callback?.({ ok: true, revision: state.revision });
      }
    );

    socket.on(
      "whiteboard:clear",
      async (payload: WhiteboardClearPayload | undefined, callback?: (ack: { ok: boolean; error?: string; revision?: number }) => void) => {
        if (!joined || !meta.roomId) {
          callback?.({ ok: false, error: "NOT_JOINED" });
          return;
        }

        const roomId = meta.roomId;
        const hostId = await ensureHostId(roomId);
        if (!hostId || hostId !== meta.userId) {
          callback?.({ ok: false, error: "NOT_HOST" });
          return;
        }

        const state = getWhiteboardState(roomId);
        state.strokes = [];
        state.updatedAt = new Date().toISOString();
        state.revision += 1;

        io.to(roomId).emit("whiteboard:clear", { by: meta.userId, revision: state.revision });
        callback?.({ ok: true, revision: state.revision });
      }
    );

    socket.on("reaction:send", (payload: ReactionSendPayload, callback?: (ack: { ok: boolean; error?: string }) => void) => {
      if (!joined || !meta.roomId) {
        callback?.({ ok: false, error: "NOT_JOINED" });
        return;
      }

      if (!payload || typeof payload.emoji !== "string" || !payload.emoji.trim().length) {
        callback?.({ ok: false, error: "EMOJI_REQUIRED" });
        return;
      }

      const reaction: ReactionEvent = {
        id: randomUUID(),
        roomId: meta.roomId,
        emoji: payload.emoji,
        userId: meta.userId,
        displayName: meta.displayName,
        createdAt: new Date().toISOString()
      } satisfies ReactionEvent;

      io.to(meta.roomId).emit("reaction:burst", reaction);
      callback?.({ ok: true });
    });

    socket.on("disconnect", async () => {
      clearHeartbeat(meta);
      if (joined && meta.roomId) {
        removeParticipant(meta.roomId, meta.userId);
        broadcastParticipants(io, meta.roomId);
        socket.to(meta.roomId).emit("user_left", { userId: meta.userId });
      }
      await recordLog({
        type: "socket:disconnect",
        roomId: meta.roomId,
        userId: meta.userId,
        payload: { socketId: socket.id }
      });
    });
  });

  return io;
}

function getParticipantMap(roomId: string): Map<string, ParticipantSessionMeta> {
  let participants = roomParticipants.get(roomId);
  if (!participants) {
    participants = new Map<string, ParticipantSessionMeta>();
    roomParticipants.set(roomId, participants);
  }
  return participants;
}

async function ensureHostId(roomId: string): Promise<string | null> {
  const meta = await ensureRoomMeta(roomId);
  return meta?.hostId ?? null;
}

async function ensureRoomMeta(roomId: string): Promise<RoomRuntimeMeta | null> {
  const cached = roomMetadata.get(roomId);
  if (cached) {
    return cached;
  }

  try {
    const room = await getRoomById(roomId);
    const maxGuests = Math.max(1, room.settings?.maxParticipants ?? 2);
    const meta: RoomRuntimeMeta = {
      hostId: room.hostId,
      maxGuests
    };
    roomMetadata.set(roomId, meta);
    roomHosts.set(roomId, room.hostId);
    return meta;
  } catch (error) {
    console.error("Failed to resolve room metadata", { roomId, error });
    return null;
  }
}

function invalidateRoomMeta(roomId: string): void {
  roomMetadata.delete(roomId);
  roomHosts.delete(roomId);
}

function broadcastParticipants(io: Server, roomId: string): void {
  const participants = roomParticipants.get(roomId);
  const hostId = roomHosts.get(roomId);
  const presenterId = roomPresenters.get(roomId);

  const payload: ParticipantsUpdatePayload = {
    roomId,
    hostId: hostId?.length ? hostId : undefined,
    presenterId: presenterId?.length ? presenterId : undefined,
    participants: participants ? toParticipantSummaries(participants) : []
  };

  io.to(roomId).emit("participants:update", payload);
}

function removeParticipant(roomId: string, userId: string): void {
  const participants = roomParticipants.get(roomId);
  if (!participants) {
    return;
  }
  const existing = participants.get(userId);
  if (!existing) {
    return;
  }

  participants.delete(userId);
  if (!participants.size) {
    roomParticipants.delete(roomId);
    roomPresenters.delete(roomId);
    roomWhiteboards.delete(roomId);
    invalidateRoomMeta(roomId);
    return;
  }

  const presenterId = roomPresenters.get(roomId);
  if (presenterId === userId) {
    const hostId = roomHosts.get(roomId);
    let fallback: string | undefined;
    if (hostId && participants.has(hostId)) {
      fallback = hostId;
    } else {
      fallback = membersFirstUser(participants);
    }
    if (fallback) {
      roomPresenters.set(roomId, fallback);
    } else {
      roomPresenters.delete(roomId);
    }
  }
}

function membersFirstUser(participants: Map<string, ParticipantSessionMeta>): string | undefined {
  const first = participants.values().next();
  return first.done ? undefined : first.value.userId;
}

function toParticipantSummaries(participants: Map<string, ParticipantSessionMeta>): RoomParticipantSummary[] {
  return Array.from(participants.values())
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    .map<RoomParticipantSummary>(({ userId, displayName, joinedAt }) => ({
      userId,
      displayName,
      joinedAt
    }));
}

function getWhiteboardState(roomId: string): MutableWhiteboardState {
  let state = roomWhiteboards.get(roomId);
  if (!state) {
    state = {
      active: false,
      strokes: [],
      revision: 0,
      updatedAt: new Date().toISOString()
    } satisfies MutableWhiteboardState;
    roomWhiteboards.set(roomId, state);
  }
  return state;
}

function toWhiteboardSnapshot(roomId: string, state: MutableWhiteboardState): WhiteboardStateSnapshot {
  return {
    roomId,
    active: state.active,
    strokes: state.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point: WhiteboardPoint) => ({ ...point }))
    })),
    revision: state.revision,
    updatedAt: state.updatedAt,
    presenterUserId: state.presenterUserId
  } satisfies WhiteboardStateSnapshot;
}

function normalizeStroke(input: WhiteboardStroke | undefined, roomId: string, userId: string): WhiteboardStroke {
  const id = input?.id?.length ? input.id : randomUUID();
  const tool: WhiteboardStroke["tool"] = input?.tool === "eraser" || input?.tool === "highlighter" ? input.tool : "pen";
  const rawSize = typeof input?.size === "number" && Number.isFinite(input.size) ? input.size : 4;
  const size = clamp(rawSize, 1, 36);
  const color = typeof input?.color === "string" && input.color?.length ? input.color : "#ffffff";
  const sourcePoints: WhiteboardStroke["points"] = Array.isArray(input?.points)
    ? (input.points as WhiteboardStroke["points"])
    : [];
  const points = sourcePoints
    .map((point: WhiteboardStroke["points"][number]) => ({
      x: clamp(typeof point?.x === "number" ? point.x : 0, 0, 1),
      y: clamp(typeof point?.y === "number" ? point.y : 0, 0, 1),
      pressure: typeof point?.pressure === "number" && Number.isFinite(point.pressure) ? clamp(point.pressure, 0, 1) : undefined,
      t: typeof point?.t === "number" && Number.isFinite(point.t) ? point.t : undefined
    }))
    .filter(
      (
        point: WhiteboardStroke["points"][number],
        index: number,
        array: WhiteboardStroke["points"]
      ) => {
      if (index === 0) {
        return true;
      }
      const previous = array[index - 1];
      if (!previous) {
        return true;
      }
      return point.x !== previous.x || point.y !== previous.y;
      }
    );

  return {
    id,
    roomId,
    userId,
    tool,
    color,
    size,
    points,
    createdAt: input?.createdAt ?? new Date().toISOString()
  } satisfies WhiteboardStroke;
}

function canAnnotate(roomId: string, userId: string): boolean {
  const state = roomWhiteboards.get(roomId);
  if (!state?.active) {
    return false;
  }
  const hostId = roomHosts.get(roomId);
  if (hostId && hostId === userId) {
    return true;
  }
  const presenterId = roomPresenters.get(roomId);
  return Boolean(presenterId && presenterId === userId);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function extractMeta(socket: Socket): ConnectionMeta | null {
  const { roomId, userId, rtcSessionId } = socket.handshake.query;
  if (typeof roomId !== "string" || typeof userId !== "string") {
    return null;
  }

  const meta: ConnectionMeta = { roomId, userId };
  if (typeof rtcSessionId === "string") {
    meta.rtcSessionId = rtcSessionId;
  }
  return meta;
}

async function handleHeartbeat(meta: ConnectionMeta, heartbeat: HeartbeatPayload, socket: Socket): Promise<void> {
  if (meta.rtcSessionId) {
    await recordHeartbeat(meta.rtcSessionId, heartbeat);
  }

  const serverTimestamp = Date.now();
  const latency = Math.max(0, serverTimestamp - heartbeat.timestamp);
  void socket.emit("signal", {
    type: "heartbeat",
    payload: { ...heartbeat, acknowledgedAt: serverTimestamp, latencyMs: latency, serverTimestamp }
  });

  const timerKey = `${meta.roomId}:${meta.userId}`;
  clearHeartbeat(meta);
  const timeout = setTimeout(() => {
    void socket.emit("network:warning", {
      message: "Heartbeat lost",
      userId: meta.userId
    });
  }, HEARTBEAT_GRACE_MS);

  heartbeatIntervals.set(timerKey, timeout);
}

function clearHeartbeat(meta: ConnectionMeta): void {
  const key = `${meta.roomId}:${meta.userId}`;
  const timer = heartbeatIntervals.get(key);
  if (timer) {
    clearTimeout(timer);
    heartbeatIntervals.delete(key);
  }
}

async function handleScreenShareStart(meta: ConnectionMeta, state: ScreenShareState): Promise<void> {
  const sessionId = await startScreenShareSession(state, meta.rtcSessionId ?? "");
  meta.screenShareSessionId = sessionId;
}

async function handleScreenShareStop(meta: ConnectionMeta): Promise<void> {
  if (meta.screenShareSessionId) {
    await stopScreenShareSession(meta.screenShareSessionId);
    delete meta.screenShareSessionId;
  }
}
