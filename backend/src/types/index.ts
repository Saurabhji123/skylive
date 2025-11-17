import { ObjectId } from "mongodb";
import type {
  RoomSummary,
  ScreenShareState,
  ChatMessage,
  DeviceInfoPayload,
  AnalyticsPayload,
  UserPreferences
} from "@skylive/shared";

export interface AvatarDocument {
  fileName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: Date;
  publicPath: string;
}

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string | undefined;
  avatar?: AvatarDocument | undefined;
  createdAt: Date;
  lastLogin?: Date | undefined;
  preferences?: UserPreferences | undefined;
  bio?: string | undefined;
  timezone?: string | undefined;
}

export interface RoomDocument extends RoomSummary {
  _id: ObjectId;
  passwordHash?: string;
  guestIds: string[];
  presence?: PresenceRecord[] | undefined;
}

export interface PresenceRecord {
  userId: string;
  username: string;
  status: "online" | "connecting" | "disconnected";
  lastHeartbeat: Date;
}

export interface RtcSessionDocument {
  _id: ObjectId;
  roomId: string;
  peerIds: string[];
  iceServersUsed: string[];
  startTime: Date;
  endTime?: Date | undefined;
  qualityMetrics?: {
    avgBitrate: number;
    avgLatency: number;
    avgJitter: number;
  };
  syncStateHistory?: {
    timestamp: Date;
    rtt: number;
    jitter: number;
    packetLoss: number;
  }[] | undefined;
}

export interface ScreenShareSessionDocument extends ScreenShareState {
  _id: ObjectId;
  rtcSessionId: string;
  endTime?: Date | undefined;
}

export interface MessageDocument extends ChatMessage {
  _id: ObjectId;
}

export interface DeviceInfoDocument extends DeviceInfoPayload {
  _id: ObjectId;
}

export interface LogDocument {
  _id: ObjectId;
  type: string;
  roomId?: string | undefined;
  userId?: string | undefined;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface AnalyticsDocument extends AnalyticsPayload {
  _id: ObjectId;
  timestamp: Date;
}

export interface RefreshTokenDocument {
  _id: ObjectId;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface PasswordResetDocument {
  _id: ObjectId;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date | undefined;
  requestIp?: string | undefined;
  userAgent?: string | undefined;
}
