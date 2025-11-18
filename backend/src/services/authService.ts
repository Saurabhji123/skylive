import { createHash } from "crypto";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/tokens";
import { badRequest, unauthorized } from "../utils/errors";
import type { UserDocument, RefreshTokenDocument } from "../types";
import { AvatarAsset } from "@skylive/shared";
import { DEFAULT_TIMEZONE, getDefaultUserPreferences } from "./userService";

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

  const isValid = await comparePassword(params.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  await users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

  const tokens = await issueTokens(user._id.toHexString(), "host");
  const response: TokenPair & {
    userId: string;
    role: "host" | "guest";
    displayName: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  } = {
    displayName: user.displayName,
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
  }

  return response;
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
