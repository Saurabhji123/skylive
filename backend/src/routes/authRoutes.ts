import { Router, type CookieOptions } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/responses";
import { registerUser, loginUser, rotateTokens, revokeRefreshToken, authenticateWithGoogle } from "../services/authService";
import { requestPasswordReset } from "../services/passwordResetService";
import { env } from "../config/env";
import { unauthorized } from "../utils/errors";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const googleAuthSchema = z.object({
  code: z.string().min(1)
});

export const authRouter = Router();

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SECURE ? "none" : "lax",
  maxAge: REFRESH_COOKIE_MAX_AGE_MS
};

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const tokens = await registerUser(body);

    res.cookie(env.COOKIE_NAME_REFRESH, tokens.refreshToken, refreshCookieOptions);

    sendSuccess(res, {
      userId: tokens.userId,
      displayName: tokens.displayName,
      accessToken: tokens.accessToken,
      role: tokens.role,
      avatarUrl: tokens.avatarUrl,
      avatar: tokens.avatar
    }, 201);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await loginUser(body);

    res.cookie(env.COOKIE_NAME_REFRESH, result.refreshToken, refreshCookieOptions);

    sendSuccess(res, {
      userId: result.userId,
      displayName: result.displayName,
      accessToken: result.accessToken,
      role: result.role,
      avatarUrl: result.avatarUrl,
      avatar: result.avatar
    });
  })
);

authRouter.post(
  "/google",
  asyncHandler(async (req, res) => {
    const { code } = googleAuthSchema.parse(req.body);
    const result = await authenticateWithGoogle(code);

    res.cookie(env.COOKIE_NAME_REFRESH, result.refreshToken, refreshCookieOptions);

    sendSuccess(res, {
      userId: result.userId,
      displayName: result.displayName,
      accessToken: result.accessToken,
      role: result.role,
      avatarUrl: result.avatarUrl,
      avatar: result.avatar
    });
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const context: { ip?: string; userAgent?: string } = {};
    if (typeof req.ip === "string" && req.ip.length) {
      context.ip = req.ip;
    }
    const userAgent = req.get("user-agent");
    if (typeof userAgent === "string" && userAgent.length) {
      context.userAgent = userAgent;
    }
    const { token } = await requestPasswordReset(body.email, context);

    if (token && env.NODE_ENV !== "production") {
      console.info(`[password-reset] dev token for ${body.email}: ${token}`);
    }

    sendSuccess(
      res,
      {
        message: "If the email is registered, you'll receive a reset link shortly."
      },
      202
    );
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const body = (req.body ?? {}) as { refreshToken?: unknown };

    const cookieToken = cookies?.[env.COOKIE_NAME_REFRESH];
    const bodyToken = typeof body.refreshToken === "string" ? body.refreshToken : undefined;
    const refreshToken = bodyToken ?? cookieToken;

    if (!refreshToken) {
      throw unauthorized("Refresh token missing", "REFRESH_TOKEN_REQUIRED");
    }

    refreshSchema.parse({ refreshToken });
    const tokens = await rotateTokens(refreshToken);

    res.cookie(env.COOKIE_NAME_REFRESH, tokens.refreshToken, refreshCookieOptions);

    sendSuccess(res, {
      userId: tokens.userId,
      accessToken: tokens.accessToken,
      role: tokens.role
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const rawBody = (req.body ?? {}) as { refreshToken?: unknown };

    const tokenFromCookie = cookies?.[env.COOKIE_NAME_REFRESH];
    const tokenFromBody = typeof rawBody.refreshToken === "string" ? rawBody.refreshToken : undefined;
    const refreshToken = tokenFromBody ?? tokenFromCookie;

    if (refreshToken) {
      refreshSchema.parse({ refreshToken });
      await revokeRefreshToken(refreshToken);
    }

    res.clearCookie(env.COOKIE_NAME_REFRESH, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SECURE ? "none" : "lax"
    });
    sendSuccess(res, { success: true });
  })
);
