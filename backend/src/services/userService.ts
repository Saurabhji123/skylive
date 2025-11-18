import { ObjectId } from "mongodb";
import { UserProfile, UserPreferences } from "@skylive/shared";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import { notFound } from "../utils/errors";
import { removeAvatarFile, type AvatarMetadata } from "../utils/uploads";
import type { RoomDocument, UserDocument } from "../types";

export interface UpdateUserProfileParams {
  displayName?: string | undefined;
  avatarUrl?: string | undefined;
  bio?: string | undefined;
  timezone?: string | undefined;
}

interface NormalizedUserPreferences {
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
    defaultVideoQuality: VideoQualitySetting;
    enableSpatialAudio: boolean;
  };
  integrations: {
    calendarSync: boolean;
    cloudBackups: boolean;
  };
}

export interface UserPreferencesUpdateInput {
  notifications?: {
    roomReminders?: boolean;
    productNews?: boolean;
    sessionSummaries?: boolean;
  } | undefined;
  privacy?: {
    analyticsSharing?: boolean;
    allowGuestDms?: boolean;
    showPresence?: boolean;
  } | undefined;
  roomDefaults?: {
    muteOnJoin?: boolean;
    autoRecordSessions?: boolean;
    defaultVideoQuality?: "auto" | "720p" | "1080p";
    enableSpatialAudio?: boolean;
  } | undefined;
  integrations?: {
    calendarSync?: boolean;
    cloudBackups?: boolean;
  } | undefined;
}

interface GuestAggregationResult {
  totalGuests: number;
  uniqueGuests: string[];
}

export const DEFAULT_TIMEZONE = "UTC";

interface StoredAvatarDocument {
  fileName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  publicPath: string;
  uploadedAt: Date;
}

interface AvatarRecordCandidate extends Record<string, unknown> {
  fileName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  publicPath: string;
  uploadedAt: Date | string;
}

function isAvatarRecordCandidate(value: Record<string, unknown>): value is AvatarRecordCandidate {
  if (typeof value.fileName !== "string" || value.fileName.length === 0) {
    return false;
  }
  if (typeof value.originalName !== "string" || value.originalName.length === 0) {
    return false;
  }
  if (typeof value.mimeType !== "string" || value.mimeType.length === 0) {
    return false;
  }
  if (typeof value.byteSize !== "number" || !Number.isFinite(value.byteSize) || value.byteSize < 0) {
    return false;
  }
  if (typeof value.publicPath !== "string" || value.publicPath.length === 0) {
    return false;
  }
  if (!(value.uploadedAt instanceof Date) && typeof value.uploadedAt !== "string") {
    return false;
  }
  return true;
}

function parseAvatarDocument(value: unknown): StoredAvatarDocument | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!isAvatarRecordCandidate(record)) {
    return null;
  }

  const { fileName, originalName, mimeType, byteSize, publicPath, uploadedAt } = record;

  if (uploadedAt instanceof Date) {
    const parsed: StoredAvatarDocument = {
      fileName,
      originalName,
      mimeType,
      byteSize,
      publicPath,
      uploadedAt
    };
    return parsed;
  }

  const timestamp = Date.parse(uploadedAt);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const parsed: StoredAvatarDocument = {
    fileName,
    originalName,
    mimeType,
    byteSize,
    publicPath,
    uploadedAt: new Date(timestamp)
  };
  return parsed;
}

function mapAvatarForProfile(avatar: unknown): AvatarMetadata | undefined {
  const parsed = parseAvatarDocument(avatar);

  if (!parsed) {
    return undefined;
  }

  const uploadedAt = parsed.uploadedAt.toISOString();

  return {
    fileName: parsed.fileName,
    originalName: parsed.originalName,
    mimeType: parsed.mimeType,
    byteSize: parsed.byteSize,
    uploadedAt,
    publicPath: parsed.publicPath
  };
}

function resolveAvatarRemovalTarget(user: UserDocument): string | null {
  const stored = parseAvatarDocument(user.avatar);
  if (stored?.fileName) {
    return stored.fileName;
  }

  if (typeof user.avatarUrl === "string" && user.avatarUrl.length > 0) {
    return user.avatarUrl;
  }

  return null;
}

export function getDefaultUserPreferences(): UserPreferences {
  const defaults: NormalizedUserPreferences = {
    notifications: {
      roomReminders: true,
      productNews: false,
      sessionSummaries: true
    },
    privacy: {
      analyticsSharing: true,
      allowGuestDms: false,
      showPresence: true
    },
    roomDefaults: {
      muteOnJoin: true,
      autoRecordSessions: false,
      defaultVideoQuality: "auto",
      enableSpatialAudio: true
    },
    integrations: {
      calendarSync: false,
      cloudBackups: true
    }
  };

  return defaults;
}

function normalizeIso(input: string | Date): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  return new Date(input).toISOString();
}

type VideoQualitySetting = "auto" | "720p" | "1080p";

const VIDEO_QUALITIES: ReadonlySet<VideoQualitySetting> = new Set(["auto", "720p", "1080p"]);

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as Record<string, unknown>;
}

function coerceBoolean(value: unknown, fallback: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return typeof fallback === "boolean" ? fallback : Boolean(fallback);
}

function coerceVideoQuality(value: unknown, fallback: unknown): VideoQualitySetting {
  if (typeof value === "string" && VIDEO_QUALITIES.has(value as VideoQualitySetting)) {
    return value as VideoQualitySetting;
  }
  if (typeof fallback === "string" && VIDEO_QUALITIES.has(fallback as VideoQualitySetting)) {
    return fallback as VideoQualitySetting;
  }
  return "auto";
}

function ensurePreferences(preferences?: UserPreferences | null): NormalizedUserPreferences {
  const defaults = getDefaultUserPreferences() as NormalizedUserPreferences;
  const preferenceRecord = toRecord(preferences) as Partial<{
    notifications: unknown;
    privacy: unknown;
    roomDefaults: unknown;
    integrations: unknown;
  }>;
  const incomingNotifications = toRecord(preferenceRecord.notifications) as Partial<
    NormalizedUserPreferences["notifications"]
  >;
  const incomingPrivacy = toRecord(preferenceRecord.privacy) as Partial<
    NormalizedUserPreferences["privacy"]
  >;
  const incomingRoomDefaults = toRecord(preferenceRecord.roomDefaults) as Partial<
    NormalizedUserPreferences["roomDefaults"]
  >;
  const incomingIntegrations = toRecord(preferenceRecord.integrations) as Partial<
    NormalizedUserPreferences["integrations"]
  >;

  return {
    notifications: {
      roomReminders: coerceBoolean(incomingNotifications.roomReminders, defaults.notifications.roomReminders),
      productNews: coerceBoolean(incomingNotifications.productNews, defaults.notifications.productNews),
      sessionSummaries: coerceBoolean(incomingNotifications.sessionSummaries, defaults.notifications.sessionSummaries)
    },
    privacy: {
      analyticsSharing: coerceBoolean(incomingPrivacy.analyticsSharing, defaults.privacy.analyticsSharing),
      allowGuestDms: coerceBoolean(incomingPrivacy.allowGuestDms, defaults.privacy.allowGuestDms),
      showPresence: coerceBoolean(incomingPrivacy.showPresence, defaults.privacy.showPresence)
    },
    roomDefaults: {
      muteOnJoin: coerceBoolean(incomingRoomDefaults.muteOnJoin, defaults.roomDefaults.muteOnJoin),
      autoRecordSessions: coerceBoolean(
        incomingRoomDefaults.autoRecordSessions,
        defaults.roomDefaults.autoRecordSessions
      ),
      defaultVideoQuality: coerceVideoQuality(
        incomingRoomDefaults.defaultVideoQuality,
        defaults.roomDefaults.defaultVideoQuality
      ),
      enableSpatialAudio: coerceBoolean(
        incomingRoomDefaults.enableSpatialAudio,
        defaults.roomDefaults.enableSpatialAudio
      )
    },
    integrations: {
      calendarSync: coerceBoolean(incomingIntegrations.calendarSync, defaults.integrations.calendarSync),
      cloudBackups: coerceBoolean(incomingIntegrations.cloudBackups, defaults.integrations.cloudBackups)
    }
  } satisfies NormalizedUserPreferences;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const rooms = db.collection<RoomDocument>(COLLECTIONS.ROOMS);
  const [roomsHosted, activeRooms, guestAggregation] = await Promise.all([
    rooms.countDocuments({ hostId: userId }),
    rooms.countDocuments({ hostId: userId, status: { $ne: "ended" } }),
    rooms
      .aggregate<GuestAggregationResult>([
        { $match: { hostId: userId } },
        { $project: { guestIds: { $ifNull: ["$guestIds", []] } } },
        { $unwind: { path: "$guestIds", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            totalGuests: { $sum: 1 },
            uniqueGuests: { $addToSet: "$guestIds" }
          }
        }
      ])
      .toArray()
  ]);

  const totalGuests = guestAggregation[0]?.totalGuests ?? 0;
  const uniqueGuests = guestAggregation[0]?.uniqueGuests?.length ?? 0;
  const preferences = ensurePreferences(user.preferences) as UserPreferences;

  const profile: UserProfile = {
    id: user._id.toHexString(),
    displayName: user.displayName,
    email: user.email,
    role: "host",
    createdAt: normalizeIso(user.createdAt),
    stats: {
      roomsHosted,
      activeRooms,
      totalGuests,
      uniqueGuests
    },
    preferences,
    timezone: user.timezone ?? DEFAULT_TIMEZONE
  };

  const avatar = mapAvatarForProfile(user.avatar);
  if (avatar) {
    profile.avatar = avatar;
    profile.avatarUrl = avatar.publicPath;
  } else if (typeof user.avatarUrl === "string" && user.avatarUrl.length > 0) {
    profile.avatarUrl = user.avatarUrl;
  }

  if (user.lastLogin) {
    profile.lastLogin = normalizeIso(user.lastLogin);
  }

  if (typeof user.bio === "string") {
    const trimmedBio = user.bio.trim();
    if (trimmedBio.length > 0) {
      profile.bio = trimmedBio;
    }
  }

  return profile;
}

export async function updateUserProfile(userId: string, updates: UpdateUserProfileParams): Promise<UserProfile> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const existing = await users.findOne({ _id: new ObjectId(userId) });

  if (!existing) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const $set: Partial<UserDocument> = {};
  const $unset: Record<string, 1> = {};

  if (typeof updates.displayName === "string") {
    const trimmedDisplayName = updates.displayName.trim();
    if (trimmedDisplayName.length > 0) {
      $set.displayName = trimmedDisplayName;
    }
  }

  if (typeof updates.avatarUrl === "string") {
    const trimmedAvatar = updates.avatarUrl.trim();
    if (trimmedAvatar.length > 0) {
      $set.avatarUrl = trimmedAvatar;
      const storedAvatar = parseAvatarDocument(existing.avatar);
      if (storedAvatar && storedAvatar.publicPath !== trimmedAvatar) {
        $unset.avatar = 1;
      }
    } else {
      $unset.avatarUrl = 1;
      if (existing.avatar) {
        $unset.avatar = 1;
      }
    }
  }

  if (typeof updates.bio === "string") {
    const trimmedBio = updates.bio.trim();
    if (trimmedBio.length > 0) {
      $set.bio = trimmedBio;
    } else {
      $unset.bio = 1;
    }
  }

  if (typeof updates.timezone === "string") {
    const trimmedTimezone = updates.timezone.trim();
    $set.timezone = trimmedTimezone.length > 0 ? trimmedTimezone : DEFAULT_TIMEZONE;
  }

  const updatePayload: {
    $set?: Partial<UserDocument>;
    $unset?: Record<string, 1>;
  } = {};

  if (Object.keys($set).length) {
    updatePayload.$set = $set;
  }

  if (Object.keys($unset).length) {
    updatePayload.$unset = $unset;
  }

  if (Object.keys(updatePayload).length) {
    await users.updateOne({ _id: existing._id }, updatePayload);
  }

  if (typeof updates.avatarUrl === "string") {
    const trimmedAvatar = updates.avatarUrl.trim();
    if (trimmedAvatar.length === 0) {
      const previous = resolveAvatarRemovalTarget(existing);
      if (previous) {
        await removeAvatarFile(previous);
      }
    } else {
      const storedAvatar = parseAvatarDocument(existing.avatar);
      if (storedAvatar && storedAvatar.publicPath !== trimmedAvatar) {
        await removeAvatarFile(storedAvatar.fileName);
      } else if (!storedAvatar && existing.avatarUrl && existing.avatarUrl !== trimmedAvatar) {
        await removeAvatarFile(existing.avatarUrl);
      }
    }
  }

  return getUserProfile(userId);
}

export async function updateUserAvatarFromUpload(userId: string, avatar: AvatarMetadata | null): Promise<UserProfile> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const existing = await users.findOne({ _id: new ObjectId(userId) });

  if (!existing) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const previousReference = resolveAvatarRemovalTarget(existing);

  if (!avatar) {
    const update: { $unset: Record<string, 1> } = { $unset: { avatar: 1, avatarUrl: 1 } };
    await users.updateOne({ _id: existing._id }, update);

    if (previousReference) {
      await removeAvatarFile(previousReference);
    }

    return getUserProfile(userId);
  }

  const storedAvatar: StoredAvatarDocument = {
    fileName: avatar.fileName,
    originalName: avatar.originalName,
    mimeType: avatar.mimeType,
    byteSize: avatar.byteSize,
    uploadedAt: new Date(avatar.uploadedAt),
    publicPath: avatar.publicPath
  };

  await users.updateOne(
    { _id: existing._id },
    {
      $set: {
        avatar: storedAvatar,
        avatarUrl: avatar.publicPath
      }
    }
  );

  if (previousReference && previousReference !== avatar.fileName) {
    await removeAvatarFile(previousReference);
  }

  return getUserProfile(userId);
}

export async function updateUserPreferences(
  userId: string,
  updates: UserPreferencesUpdateInput
): Promise<UserPreferences> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const user = await users.findOne({ _id: new ObjectId(userId) });

  if (!user) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const current = ensurePreferences(user.preferences);
  const next: NormalizedUserPreferences = {
    notifications: {
      roomReminders: coerceBoolean(updates.notifications?.roomReminders, current.notifications.roomReminders),
      productNews: coerceBoolean(updates.notifications?.productNews, current.notifications.productNews),
      sessionSummaries: coerceBoolean(updates.notifications?.sessionSummaries, current.notifications.sessionSummaries)
    },
    privacy: {
      analyticsSharing: coerceBoolean(updates.privacy?.analyticsSharing, current.privacy.analyticsSharing),
      allowGuestDms: coerceBoolean(updates.privacy?.allowGuestDms, current.privacy.allowGuestDms),
      showPresence: coerceBoolean(updates.privacy?.showPresence, current.privacy.showPresence)
    },
    roomDefaults: {
      muteOnJoin: coerceBoolean(updates.roomDefaults?.muteOnJoin, current.roomDefaults.muteOnJoin),
      autoRecordSessions: coerceBoolean(
        updates.roomDefaults?.autoRecordSessions,
        current.roomDefaults.autoRecordSessions
      ),
      defaultVideoQuality: coerceVideoQuality(
        updates.roomDefaults?.defaultVideoQuality,
        current.roomDefaults.defaultVideoQuality
      ),
      enableSpatialAudio: coerceBoolean(
        updates.roomDefaults?.enableSpatialAudio,
        current.roomDefaults.enableSpatialAudio
      )
    },
    integrations: {
      calendarSync: coerceBoolean(updates.integrations?.calendarSync, current.integrations.calendarSync),
      cloudBackups: coerceBoolean(updates.integrations?.cloudBackups, current.integrations.cloudBackups)
    }
  } satisfies NormalizedUserPreferences;

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        preferences: next
      }
    }
  );

  return next as UserPreferences;
}
