import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

const FALLBACK_ROOT = path.resolve(process.cwd(), "uploads", "avatars");
const FALLBACK_PUBLIC_PATH = "/media/avatars";
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp"
};
const FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function sanitizeOptionalString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

const configuredRoot = sanitizeOptionalString(env.AVATAR_UPLOAD_ROOT ?? null);
const configuredPublicPath = sanitizeOptionalString(env.AVATAR_PUBLIC_PATH ?? null);

const rootDirectory = configuredRoot ? path.resolve(configuredRoot) : FALLBACK_ROOT;
const basePublicPath = configuredPublicPath ? configuredPublicPath : FALLBACK_PUBLIC_PATH;
const publicPath = basePublicPath.replace(/\/+$/, "");

export const avatarStorageConfig = {
  root: rootDirectory,
  publicPath
} as const;

export interface AvatarMetadata {
  fileName: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  publicPath: string;
}

export async function initializeAvatarStorage(): Promise<void> {
  await fs.mkdir(avatarStorageConfig.root, { recursive: true });
}

function normalizeExtension(originalName: string, mimeType?: string): string {
  const fallback = mimeType ? EXTENSION_BY_MIME[mimeType.toLowerCase()] : undefined;
  const extFromName = path.extname(originalName).toLowerCase();

  if (ALLOWED_EXTENSIONS.has(extFromName)) {
    return extFromName === ".jpeg" ? ".jpg" : extFromName;
  }

  if (fallback && ALLOWED_EXTENSIONS.has(fallback)) {
    return fallback;
  }

  return ".png";
}

export function generateAvatarFileName(originalName: string, mimeType?: string): string {
  const ext = normalizeExtension(originalName, mimeType);
  const id = crypto.randomUUID().replace(/-/g, "");
  return `${Date.now()}-${id}${ext}`;
}

export function resolveAvatarAbsolutePath(fileName: string): string {
  return path.join(avatarStorageConfig.root, fileName);
}

export function buildAvatarPublicPath(fileName: string): string {
  return `${avatarStorageConfig.publicPath}/${fileName}`;
}

export async function persistAvatarFile(fileName: string, data: Buffer): Promise<void> {
  const destination = resolveAvatarAbsolutePath(fileName);
  await fs.writeFile(destination, data);
}

export function extractAvatarFileName(reference?: string | null): string | null {
  if (!reference) {
    return null;
  }

  const trimmed = reference.trim();
  if (!trimmed) {
    return null;
  }

  const withoutParams = trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
  const normalized = withoutParams.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length) {
    return FILENAME_PATTERN.test(normalized) ? normalized : null;
  }

  const candidate = segments[segments.length - 1] ?? "";
  if (!candidate || !FILENAME_PATTERN.test(candidate)) {
    return null;
  }

  return candidate;
}

export async function removeAvatarFile(reference?: string | null): Promise<void> {
  const fileName = extractAvatarFileName(reference);
  if (!fileName) {
    return;
  }

  const absolute = resolveAvatarAbsolutePath(fileName);
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}
