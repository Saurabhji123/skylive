import { API_BASE_URL } from "./config";

function getOrigin(): string {
  const trimmed = (API_BASE_URL ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  const lower = withoutTrailingSlash.toLowerCase();

  if (lower.endsWith("/api")) {
    return withoutTrailingSlash.slice(0, -4) || "";
  }

  return withoutTrailingSlash;
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const DATA_URI_PATTERN = /^data:/i;

export function resolveAvatarUrl(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed) || DATA_URI_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const origin = getOrigin();
  if (!origin) {
    return normalized;
  }

  return `${origin}${normalized}`;
}
