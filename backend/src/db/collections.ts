import { Db } from "mongodb";

export const COLLECTIONS = {
  USERS: "users",
  ROOMS: "rooms",
  RTC_SESSIONS: "rtcSessions",
  SCREEN_SHARE_SESSIONS: "screenShareSessions",
  MESSAGES: "messages",
  DEVICE_INFO: "deviceInfo",
  LOGS: "logs",
  ANALYTICS: "analytics",
  REFRESH_TOKENS: "refreshTokens",
  PASSWORD_RESETS: "passwordResets"
} as const;

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(COLLECTIONS.USERS).createIndex({ email: 1 }, { unique: true, name: "users_email_unique" }),
    db.collection(COLLECTIONS.USERS).createIndex({ displayName: 1 }, { name: "users_displayName" }),

    db.collection(COLLECTIONS.ROOMS).createIndex({ roomCode: 1 }, { unique: true, name: "rooms_roomCode_unique" }),
    db.collection(COLLECTIONS.ROOMS).createIndex({ hostId: 1, status: 1 }, { name: "rooms_host_status" }),
    db.collection(COLLECTIONS.ROOMS).createIndex({ createdAt: -1 }, { name: "rooms_createdAt" }),

    db.collection(COLLECTIONS.RTC_SESSIONS).createIndex({ roomId: 1, startTime: -1 }, { name: "rtc_room_start" }),
    db.collection(COLLECTIONS.SCREEN_SHARE_SESSIONS).createIndex({ rtcSessionId: 1 }, { name: "share_session_rtc" }),

    db.collection(COLLECTIONS.MESSAGES).createIndex({ roomId: 1, createdAt: -1 }, { name: "messages_room_createdAt" }),
    db.collection(COLLECTIONS.MESSAGES).createIndex({ senderId: 1, createdAt: -1 }, { name: "messages_sender" }),

    db.collection(COLLECTIONS.DEVICE_INFO).createIndex({ userId: 1 }, { name: "device_userId" }),
    db.collection(COLLECTIONS.DEVICE_INFO).createIndex({ deviceId: 1 }, { unique: true, name: "device_deviceId_unique" }),

    db.collection(COLLECTIONS.LOGS).createIndex({ createdAt: -1 }, { name: "logs_createdAt" }),
    db.collection(COLLECTIONS.LOGS).createIndex({ roomId: 1, createdAt: -1 }, { name: "logs_room_createdAt" }),

    db.collection(COLLECTIONS.ANALYTICS).createIndex({ roomId: 1, timestamp: -1 }, { name: "analytics_room_timestamp" }),

    db.collection(COLLECTIONS.REFRESH_TOKENS).createIndex({ tokenHash: 1 }, { unique: true, name: "refresh_token_hash" }),
    db.collection(COLLECTIONS.REFRESH_TOKENS).createIndex({ userId: 1 }, { name: "refresh_token_user" }),

    db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ tokenHash: 1 }, { unique: true, name: "password_reset_token_hash" }),
    db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ userId: 1, createdAt: -1 }, { name: "password_reset_user_createdAt" }),
    db.collection(COLLECTIONS.PASSWORD_RESETS).createIndex({ expiresAt: 1 }, { name: "password_reset_expiresAt" })
  ]);
}
