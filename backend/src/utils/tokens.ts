import type { StringValue } from "ms";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

interface TokenPayload {
  sub: string;
  role: "host" | "guest";
  roomId?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  const secret = env.JWT_ACCESS_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as StringValue
  };
  return jwt.sign(payload, secret, options);
}

export function signRefreshToken(payload: TokenPayload): string {
  const secret = env.JWT_REFRESH_SECRET as Secret;
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_TTL as StringValue
  };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}
