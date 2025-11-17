import { ObjectId } from "mongodb";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import type { PresenceRecord, RoomDocument } from "../types";
import { notFound } from "../utils/errors";
import { getRecentMessages } from "./messageService";
import { getRoomById } from "./roomService";

export interface ParticipantPresenceInput {
  userId: string;
  username: string;
  status: PresenceRecord["status"];
  lastHeartbeat: number;
}

export async function updateRoomPresence(roomId: string, participants: ParticipantPresenceInput[]): Promise<void> {
  const db = await getDb();
  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const presence: PresenceRecord[] = participants.map((participant) => ({
    userId: participant.userId,
    username: participant.username,
    status: participant.status,
    lastHeartbeat: new Date(participant.lastHeartbeat)
  }));

  const result = await rooms.updateOne({ _id: new ObjectId(roomId) }, { $set: { presence } });
  if (!result.matchedCount) {
    throw notFound("Room not found", "ROOM_NOT_FOUND");
  }
}

export async function getRoomState(roomId: string): Promise<{ room: RoomDocument; messages: unknown[] }> {
  const room = await getRoomById(roomId);

  const messages = await getRecentMessages(roomId);
  return { room, messages };
}
