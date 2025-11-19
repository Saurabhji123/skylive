import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { OAuth2Client } from "google-auth-library";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/tokens";
import { badRequest, unauthorized } from "../utils/errors";
import type { UserDocument, RefreshTokenDocument } from "../types";
import { AvatarAsset } from "@skylive/shared";
import { DEFAULT_TIMEZONE, getDefaultUserPreferences } from "./userService";
import { env } from "../config/env";

interface RegisterParams {
  email: string;
  password: string;
  displayName: string;
}

interface LoginParams {
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const googleOAuthClient = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, "postmessage")
  : null;

function buildAuthResponse(
  user: UserDocument,
  tokens: TokenPair & { userId: string; role: "host" | "guest" },
  displayName: string,
  fallbackAvatarUrl?: string
): TokenPair & {
  userId: string;
  role: "host" | "guest";
  displayName: string;
  avatarUrl?: string;
  avatar?: AvatarAsset;
} {
  const response: TokenPair & {
    userId: string;
    role: "host" | "guest";
    displayName: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  } = {
    displayName,
    ...tokens
  };

  if (user.avatar) {
    response.avatar = {
      fileName: user.avatar.fileName,
      originalName: user.avatar.originalName,
      mimeType: user.avatar.mimeType,
      byteSize: user.avatar.byteSize,
      uploadedAt: user.avatar.uploadedAt instanceof Date
        ? user.avatar.uploadedAt.toISOString()
        : new Date(user.avatar.uploadedAt).toISOString(),
      publicPath: user.avatar.publicPath
    };
    response.avatarUrl = response.avatar.publicPath;
  } else if (typeof user.avatarUrl === "string" && user.avatarUrl.length > 0) {
    response.avatarUrl = user.avatarUrl;
  } else if (fallbackAvatarUrl) {
    response.avatarUrl = fallbackAvatarUrl;
  }

  return response;
}

export async function registerUser(
  params: RegisterParams
): Promise<
  TokenPair & {
    userId: string;
    role: "host" | "guest";
    displayName: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  }
> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);

  const existing = await users.findOne({ email: params.email });
  if (existing) {
    throw badRequest("Email already registered", "EMAIL_IN_USE");
  }

  const passwordHash = await hashPassword(params.password);
  const { insertedId } = await users.insertOne({
    email: params.email,
    passwordHash,
    displayName: params.displayName,
    createdAt: new Date(),
    avatarUrl: undefined,
    preferences: getDefaultUserPreferences(),
    timezone: DEFAULT_TIMEZONE,
    bio: ""
  } as unknown as UserDocument);

  const tokenBundle = await issueTokens(insertedId.toHexString(), "host");
  return {
    displayName: params.displayName,
    ...tokenBundle
  };
}

export async function loginUser(
  params: LoginParams
): Promise<
  TokenPair & {
    userId: string;
    role: "host" | "guest";
    displayName: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  }
> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const user = await users.findOne({ email: params.email });

  if (!user) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  if (!user.passwordHash) {
    throw unauthorized("This account uses Google Sign-In. Please continue with Google.", "PASSWORD_AUTH_DISABLED");
  }

  const isValid = await comparePassword(params.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  await users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

  const tokens = await issueTokens(user._id.toHexString(), "host");
  return buildAuthResponse(user, tokens, user.displayName);
}

export async function authenticateWithGoogle(
  code: string
): Promise<
  TokenPair & {
    userId: string;
    role: "host" | "guest";
    displayName: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  }
> {
  if (!googleOAuthClient || !env.GOOGLE_CLIENT_ID) {
    throw badRequest("Google Sign-In is not configured", "GOOGLE_AUTH_NOT_CONFIGURED");
  }

  try {
    const { tokens } = await googleOAuthClient.getToken(code);
    if (!tokens?.id_token) {
      throw new Error("Missing id_token from Google response");
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("Google account is missing an email address");
    }

    if (payload.email_verified === false) {
      throw new Error("Google email is not verified");
    }

    const googleId = payload.sub;
    if (!googleId) {
      throw new Error("Google account identifier missing");
    }

    const email = payload.email.toLowerCase();
    const googleProfileName = typeof payload.name === "string" ? payload.name.trim() : "";
    const displayName = googleProfileName.length > 0 ? googleProfileName : email.split("@")[0];
    const pictureUrl = typeof payload.picture === "string" && payload.picture.length > 0 ? payload.picture : undefined;
    const now = new Date();

    const db = await getDb();
    const users = db.collection<UserDocument>(COLLECTIONS.USERS);

    let user = await users.findOne({ $or: [{ googleId }, { email }] });

    if (user && user.googleId && user.googleId !== googleId) {
      throw unauthorized("Account already linked to a different Google profile", "GOOGLE_ACCOUNT_MISMATCH");
    }

    if (!user) {
      const userId = new ObjectId();
      const newUser: UserDocument = {
        _id: userId,
        email,
        displayName,
        avatarUrl: pictureUrl,
        createdAt: now,
        lastLogin: now,
        preferences: getDefaultUserPreferences(),
        bio: "",
        timezone: DEFAULT_TIMEZONE,
        googleId,
        authProviders: {
          google: {
            id: googleId,
            linkedAt: now,
            email
          }
        }
      };

      await users.insertOne(newUser as unknown as UserDocument);
      user = newUser;
    } else {
      const update: Partial<UserDocument> = {
        lastLogin: now,
        authProviders: {
          ...user.authProviders,
          google: {
            id: googleId,
            linkedAt: now,
            email
          }
        }
      };

      if (!user.googleId) {
        update.googleId = googleId;
      }

      if (!user.displayName && displayName) {
        update.displayName = displayName;
      }

      if (pictureUrl && pictureUrl !== user.avatarUrl) {
        update.avatarUrl = pictureUrl;
      }

      await users.updateOne({ _id: user._id }, { $set: update });
      user = { ...user, ...update } as UserDocument;
    }

    const tokensWithIds = await issueTokens(user._id.toHexString(), "host");
    const resolvedDisplayName = user.displayName && user.displayName.trim().length > 0 ? user.displayName : displayName;
    return buildAuthResponse(user, tokensWithIds, resolvedDisplayName, pictureUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "Account already linked to a different Google profile") {
      throw error;
    }

    throw unauthorized("Unable to authenticate with Google", "GOOGLE_AUTH_FAILED");
  }
}

export async function rotateTokens(refreshToken: string): Promise<TokenPair & { userId: string; role: "host" | "guest" }> {
  const payload = await verifyRefreshTokenStored(refreshToken);
  return issueTokens(payload.userId, payload.role);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const payload = await verifyRefreshTokenStored(refreshToken);
  const db = await getDb();
  const refreshTokens = db.collection<RefreshTokenDocument>(COLLECTIONS.REFRESH_TOKENS);
  await refreshTokens.deleteMany({ userId: payload.userId, tokenHash: hashToken(refreshToken) });
}

async function verifyRefreshTokenStored(token: string): Promise<{ userId: string; role: "host" | "guest" }> {
  const db = await getDb();
  const refreshTokens = db.collection<RefreshTokenDocument>(COLLECTIONS.REFRESH_TOKENS);
  const tokenHash = hashToken(token);
  const stored = await refreshTokens.findOne({ tokenHash });
  if (!stored) {
    throw unauthorized("Refresh token revoked", "REFRESH_REVOKED");
  }

  if (stored.expiresAt < new Date()) {
    await refreshTokens.deleteOne({ _id: stored._id });
    throw unauthorized("Refresh token expired", "REFRESH_EXPIRED");
  }

  return { userId: stored.userId, role: "host" };
}

async function issueTokens(userId: string, role: "host" | "guest"): Promise<TokenPair & { userId: string; role: "host" | "guest" }> {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, role });

  const db = await getDb();
  const refreshTokens = db.collection<RefreshTokenDocument>(COLLECTIONS.REFRESH_TOKENS);

  await refreshTokens.insertOne({
    tokenHash: hashToken(refreshToken),
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
  } as unknown as RefreshTokenDocument);

  return { accessToken, refreshToken, userId, role };
}
