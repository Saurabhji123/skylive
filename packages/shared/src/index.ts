export type Role = "host" | "guest";

export interface AvatarAsset {
  fileName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  publicPath: string;
}

export interface UserSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | undefined;
  avatar?: AvatarAsset | undefined;
  role: Role;
}

export interface UserProfileStats {
  roomsHosted: number;
  activeRooms: number;
  totalGuests: number;
  uniqueGuests: number;
}

export interface UserPreferences {
  notifications: {
    roomReminders: boolean;
    productNews: boolean;
    sessionSummaries: boolean;
  };
  privacy: {
    analyticsSharing: boolean;
    allowGuestDms: boolean;
    showPresence: boolean;
  };
  roomDefaults: {
    muteOnJoin: boolean;
    autoRecordSessions: boolean;
    defaultVideoQuality: "auto" | "720p" | "1080p";
    enableSpatialAudio: boolean;
  };
  integrations: {
    calendarSync: boolean;
    cloudBackups: boolean;
  };
}

export interface UserProfile extends UserSummary {
  email: string;
  createdAt: string;
  lastLogin?: string | undefined;
  stats: UserProfileStats;
  preferences: UserPreferences;
  bio?: string | undefined;
  timezone?: string | undefined;
}

export interface RoomSettings {
  maxParticipants: number;
  allowPassword: boolean;
  allowReactions: boolean;
}

export type RoomStatus = "pending" | "live" | "ended" | "suspended";

export interface RoomSummary {
  id: string;
  roomCode: string;
  joinLink: string;
  status: RoomStatus;
  hostId: string;
  settings: RoomSettings;
  createdAt: string;
  endedAt?: string | undefined;
  isLocked?: boolean | undefined;
  activeRtcSessionId?: string | undefined;
  lastActivatedAt?: string | undefined;
  deletedAt?: string | undefined;
  sessionCount?: number | undefined;
}

export interface RoomStats {
  total: number;
  pending: number;
  live: number;
  ended: number;
  suspended: number;
  totalSessions: number;
}

export interface RoomEndRequestPayload {
  roomId: string;
  endedBy: string;
  reason?: string | undefined;
}

export interface RoomEndedPayload {
  roomId: string;
  endedBy: string;
  endedAt: string;
  reason?: string | undefined;
}

export interface RtcQualityMetrics {
  averageBitrate: number;
  averageLatency: number;
  jitter: number;
  packetLoss: number;
}

export interface HeartbeatPayload {
  userId: string;
  roomId: string;
  timestamp: number;
  rtt: number;
  quality: "excellent" | "good" | "poor" | "critical";
  jitter?: number | undefined;
  latencyMs?: number | undefined;
  acknowledgedAt?: number | undefined;
  serverTimestamp?: number | undefined;
}

export interface ScreenShareSwitchEvent {
  switchedAt: string;
  fromSource: "screen" | "window" | "tab";
  toSource: "screen" | "window" | "tab";
  reason?: string | undefined;
}

export interface ScreenShareState {
  presenterId: string;
  mediaSource: "screen" | "window" | "tab";
  isActive: boolean;
  startedAt: string;
  switchEvents: ScreenShareSwitchEvent[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: "text" | "system";
  createdAt: string;
}

export interface RoomParticipantSummary {
  userId: string;
  displayName?: string | undefined;
  joinedAt?: string | undefined;
}

export interface ParticipantsUpdatePayload {
  roomId: string;
  hostId?: string | undefined;
  presenterId?: string | undefined;
  participants: RoomParticipantSummary[];
}

export type WhiteboardTool = "pen" | "eraser" | "highlighter";

export interface WhiteboardPoint {
  x: number;
  y: number;
  pressure?: number | undefined;
  t?: number | undefined;
}

export interface WhiteboardStroke {
  id: string;
  roomId: string;
  userId: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: WhiteboardPoint[];
  createdAt: string;
}

export interface WhiteboardStateSnapshot {
  roomId: string;
  active: boolean;
  strokes: WhiteboardStroke[];
  revision: number;
  updatedAt: string;
  presenterUserId?: string | undefined;
}

export interface WhiteboardTogglePayload {
  roomId: string;
  active: boolean;
  userId: string;
}

export interface WhiteboardClearPayload {
  roomId: string;
  userId: string;
}

export interface WhiteboardStrokePayload {
  roomId: string;
  stroke: WhiteboardStroke;
}

export interface WhiteboardToggleAck {
  ok: boolean;
  error?: string | undefined;
  state?: WhiteboardStateSnapshot | undefined;
}

export interface WhiteboardStrokeAck {
  ok: boolean;
  error?: string | undefined;
  revision?: number | undefined;
}

export interface WhiteboardClearAck {
  ok: boolean;
  error?: string | undefined;
  revision?: number | undefined;
}

export interface ReactionSendPayload {
  roomId: string;
  emoji: string;
}

export interface ReactionEvent {
  id: string;
  roomId: string;
  emoji: string;
  userId: string;
  displayName?: string | undefined;
  createdAt: string;
}

export type ModerationActionType = "mute" | "block" | "presenter";

export interface ModerationActionPayload {
  type: ModerationActionType;
  targetUserId: string;
  reason?: string | undefined;
}

export interface ModerationNoticePayload {
  by?: string | undefined;
  reason?: string | undefined;
}

export interface DeviceInfoPayload {
  userId: string;
  deviceId: string;
  browser: string;
  os: string;
  capabilities: {
    supportsScreenAudio: boolean;
    supportsFullScreen: boolean;
    canShareSystemAudio: boolean;
  };
  lastUsed: string;
}

export interface AnalyticsPayload {
  roomId: string;
  framesDropped: number;
  averageJitter: number;
  reconnectCount: number;
  watchDurationSeconds: number;
  surveyScore?: number | undefined;
}

export interface SignalingOffer {
  sdp: string;
  type: "offer";
}

export interface SignalingAnswer {
  sdp: string;
  type: "answer";
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid?: string | undefined;
  sdpMLineIndex?: number | undefined;
}

export type SignalingEvent =
  | { type: "offer"; payload: SignalingOffer }
  | { type: "answer"; payload: SignalingAnswer }
  | { type: "ice-candidate"; payload: IceCandidatePayload }
  | { type: "heartbeat"; payload: HeartbeatPayload }
  | { type: "share-started"; payload: ScreenShareState }
  | { type: "share-stopped"; payload: { roomId: string; presenterId: string; stoppedAt: string } };

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string | undefined;
}
