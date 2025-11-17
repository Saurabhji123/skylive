import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/responses";
import { requireAuth, AuthenticatedRequest } from "../middleware/authMiddleware";
import { badRequest } from "../utils/errors";
import type { UserPreferences } from "@skylive/shared";
import {
  getUserProfile,
  updateUserProfile,
  updateUserPreferences,
  updateUserAvatarFromUpload,
  type UpdateUserProfileParams,
  type UserPreferencesUpdateInput
} from "../services/userService";
import {
  generateAvatarFileName,
  persistAvatarFile,
  buildAvatarPublicPath
} from "../utils/uploads";

const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_UPLOAD_LIMIT_BYTES = 2 * 1024 * 1024;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_UPLOAD_LIMIT_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(badRequest("Unsupported avatar format. Use PNG, JPG, or WEBP.", "AVATAR_FORMAT_INVALID"));
  }
});

const relativeAvatarPattern = /^\/?uploads\/avatars\/[A-Za-z0-9._-]+$/;

const avatarUrlSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      return;
    }

    if (relativeAvatarPattern.test(value)) {
      return;
    }

    try {
      void new URL(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Avatar URL must be empty, a full URL, or an uploads/avatars path"
      });
    }
  });

const updateProfileSchema = z
  .object({
    displayName: z.string().min(2).max(64).trim().optional(),
    avatarUrl: avatarUrlSchema.optional(),
    bio: z.string().max(280).optional(),
    timezone: z.string().min(2).max(64).optional()
  })
  .refine((value) => Boolean(value.displayName ?? value.avatarUrl ?? value.bio ?? value.timezone), {
    message: "At least one field must be provided",
    path: ["displayName"]
  });

const updatePreferencesSchema = z
  .object({
    notifications: z
      .object({
        roomReminders: z.boolean().optional(),
        productNews: z.boolean().optional(),
        sessionSummaries: z.boolean().optional()
      })
      .optional(),
    privacy: z
      .object({
        analyticsSharing: z.boolean().optional(),
        allowGuestDms: z.boolean().optional(),
        showPresence: z.boolean().optional()
      })
      .optional(),
    roomDefaults: z
      .object({
        muteOnJoin: z.boolean().optional(),
        autoRecordSessions: z.boolean().optional(),
        defaultVideoQuality: z.enum(["auto", "720p", "1080p"]).optional(),
        enableSpatialAudio: z.boolean().optional()
      })
      .optional(),
    integrations: z
      .object({
        calendarSync: z.boolean().optional(),
        cloudBackups: z.boolean().optional()
      })
      .optional()
  })
    .refine(
      (value) =>
        Boolean(
          value.notifications ??
            value.privacy ??
            value.roomDefaults ??
            value.integrations
        ),
      {
    message: "At least one preference field must be provided",
    path: ["notifications"]
      }
    );

export const userRouter = Router();

userRouter.get(
  "/profile",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const profile = await getUserProfile(req.user.id);
    sendSuccess(res, profile);
  })
);

userRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const body = updateProfileSchema.parse(req.body ?? {});
    const normalized: UpdateUserProfileParams = {};

    if (body.displayName !== undefined) {
      normalized.displayName = body.displayName;
    }

    if (body.avatarUrl !== undefined) {
      normalized.avatarUrl = body.avatarUrl;
    }

    if (body.bio !== undefined) {
      normalized.bio = body.bio;
    }

    if (body.timezone !== undefined) {
      normalized.timezone = body.timezone;
    }

    const profile = await updateUserProfile(req.user.id, normalized);
    sendSuccess(res, profile);
  })
);

userRouter.post(
  "/avatar",
  requireAuth,
  avatarUpload.single("avatar"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    if (!req.file) {
      throw badRequest("Avatar file missing", "AVATAR_FILE_MISSING");
    }

    const fileName = generateAvatarFileName(req.file.originalname, req.file.mimetype);
    await persistAvatarFile(fileName, req.file.buffer);
    const publicPath = buildAvatarPublicPath(fileName);
    const profile = await updateUserAvatarFromUpload(req.user.id, {
      fileName,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      byteSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      publicPath
    });
    sendSuccess(res, profile);
  })
);

userRouter.delete(
  "/avatar",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const profile = await updateUserAvatarFromUpload(req.user.id, null);
    sendSuccess(res, profile);
  })
);

userRouter.patch(
  "/preferences",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw badRequest("User context missing", "USER_CONTEXT_MISSING");
    }

    const body = updatePreferencesSchema.parse(req.body ?? {});
    const updates: UserPreferencesUpdateInput = {};

    if (body.notifications) {
      const notifications: Partial<UserPreferences["notifications"]> = {};
      if (typeof body.notifications.roomReminders === "boolean") {
        notifications.roomReminders = body.notifications.roomReminders;
      }
      if (typeof body.notifications.productNews === "boolean") {
        notifications.productNews = body.notifications.productNews;
      }
      if (typeof body.notifications.sessionSummaries === "boolean") {
        notifications.sessionSummaries = body.notifications.sessionSummaries;
      }
      if (Object.keys(notifications).length) {
        updates.notifications = notifications;
      }
    }

    if (body.privacy) {
      const privacy: Partial<UserPreferences["privacy"]> = {};
      if (typeof body.privacy.analyticsSharing === "boolean") {
        privacy.analyticsSharing = body.privacy.analyticsSharing;
      }
      if (typeof body.privacy.allowGuestDms === "boolean") {
        privacy.allowGuestDms = body.privacy.allowGuestDms;
      }
      if (typeof body.privacy.showPresence === "boolean") {
        privacy.showPresence = body.privacy.showPresence;
      }
      if (Object.keys(privacy).length) {
        updates.privacy = privacy;
      }
    }

    if (body.roomDefaults) {
      const roomDefaults: Partial<UserPreferences["roomDefaults"]> = {};
      if (typeof body.roomDefaults.muteOnJoin === "boolean") {
        roomDefaults.muteOnJoin = body.roomDefaults.muteOnJoin;
      }
      if (typeof body.roomDefaults.autoRecordSessions === "boolean") {
        roomDefaults.autoRecordSessions = body.roomDefaults.autoRecordSessions;
      }
      if (typeof body.roomDefaults.defaultVideoQuality === "string") {
        roomDefaults.defaultVideoQuality = body.roomDefaults.defaultVideoQuality;
      }
      if (typeof body.roomDefaults.enableSpatialAudio === "boolean") {
        roomDefaults.enableSpatialAudio = body.roomDefaults.enableSpatialAudio;
      }
      if (Object.keys(roomDefaults).length) {
        updates.roomDefaults = roomDefaults;
      }
    }

    if (body.integrations) {
      const integrations: Partial<UserPreferences["integrations"]> = {};
      if (typeof body.integrations.calendarSync === "boolean") {
        integrations.calendarSync = body.integrations.calendarSync;
      }
      if (typeof body.integrations.cloudBackups === "boolean") {
        integrations.cloudBackups = body.integrations.cloudBackups;
      }
      if (Object.keys(integrations).length) {
        updates.integrations = integrations;
      }
    }

    const preferences = await updateUserPreferences(req.user.id, updates);
    sendSuccess(res, preferences);
  })
);
