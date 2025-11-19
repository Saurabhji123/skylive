import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url(),
  MONGO_URI: z.string().min(1),
  MONGO_FALLBACK_URI: z.string().min(1).optional(),
  MONGO_DB_NAME: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  TURN_STATIC_CREDENTIAL: z.string().optional(),
  TURN_STATIC_USERNAME: z.string().optional(),
  TURN_ENDPOINT: z.string().url().optional(),
  TURN_RELEASE_WEBHOOK: z.string().url().optional(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(120),
  COOKIE_NAME_REFRESH: z.string().default("skylive_refresh"),
  COOKIE_SECURE: z.coerce.boolean().default(true),
  AVATAR_UPLOAD_ROOT: z.string().optional(),
  AVATAR_PUBLIC_PATH: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

type ParsedEnv = z.infer<typeof envSchema>;

export type Env = Readonly<ParsedEnv>;

export const env: Env = Object.freeze(parsedEnv.data);

export const isProd = env.NODE_ENV === "production";
