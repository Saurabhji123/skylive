import { createHash, randomBytes } from "crypto";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";
import type { PasswordResetDocument, UserDocument } from "../types";

interface ResetRequestContext {
  ip?: string;
  userAgent?: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
  email: string,
  context: ResetRequestContext = {}
): Promise<{ token?: string }> {
  const db = await getDb();
  const users = db.collection<UserDocument>(COLLECTIONS.USERS);
  const resets = db.collection<PasswordResetDocument>(COLLECTIONS.PASSWORD_RESETS);

  const user = await users.findOne({ email });
  if (!user) {
    return {};
  }

  const userId = user._id.toHexString();
  await resets.deleteMany({ userId, consumedAt: { $exists: false } });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  await resets.insertOne({
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
    requestIp: context.ip,
    userAgent: context.userAgent
  } as unknown as PasswordResetDocument);

  return { token: rawToken };
}
