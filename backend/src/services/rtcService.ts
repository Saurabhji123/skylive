import { ObjectId } from "mongodb";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import type {
  RtcSessionDocument,
  ScreenShareSessionDocument
} from "../types";
import type { ScreenShareState, HeartbeatPayload } from "@skylive/shared";

export async function startRtcSession(roomId: string, peerIds: string[], iceServers: string[]): Promise<string> {
  const db = await getDb();
  const sessions = db.collection<RtcSessionDocument>(COLLECTIONS.RTC_SESSIONS);
  const result = await sessions.insertOne({
    _id: new ObjectId(),
    roomId,
    peerIds,
    iceServersUsed: iceServers,
    startTime: new Date()
  } as unknown as RtcSessionDocument);
  return result.insertedId.toHexString();
}

export async function endRtcSession(rtcSessionId: string): Promise<void> {
  const db = await getDb();
  const sessions = db.collection<RtcSessionDocument>(COLLECTIONS.RTC_SESSIONS);
  await sessions.updateOne(
    { _id: new ObjectId(rtcSessionId) },
    { $set: { endTime: new Date() } }
  );
}

export async function recordHeartbeat(rtcSessionId: string, heartbeat: HeartbeatPayload): Promise<void> {
  const db = await getDb();
  const sessions = db.collection<RtcSessionDocument>(COLLECTIONS.RTC_SESSIONS);
  await sessions.updateOne(
    { _id: new ObjectId(rtcSessionId) },
    {
      $push: {
        syncStateHistory: {
          timestamp: new Date(heartbeat.timestamp),
          rtt: heartbeat.rtt,
          jitter: heartbeat.quality === "excellent" ? 5 : heartbeat.quality === "good" ? 15 : 30,
          packetLoss: heartbeat.quality === "excellent" ? 0.5 : heartbeat.quality === "good" ? 1.5 : 4
        }
      }
    }
  );
}

export async function startScreenShareSession(state: ScreenShareState, rtcSessionId: string): Promise<string> {
  const db = await getDb();
  const shares = db.collection<ScreenShareSessionDocument>(COLLECTIONS.SCREEN_SHARE_SESSIONS);
  const insert = await shares.insertOne({
    _id: new ObjectId(),
    rtcSessionId,
    ...state
  } as unknown as ScreenShareSessionDocument);
  return insert.insertedId.toHexString();
}

export async function stopScreenShareSession(sessionId: string): Promise<void> {
  const db = await getDb();
  const shares = db.collection<ScreenShareSessionDocument>(COLLECTIONS.SCREEN_SHARE_SESSIONS);
  await shares.updateOne({ _id: new ObjectId(sessionId) }, { $set: { endTime: new Date() } });
}
