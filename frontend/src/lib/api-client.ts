import type { ApiError, ApiSuccess } from "@skylive/shared";
import { useSessionStore, type Role } from "@/store/session-store";
import { API_BASE_URL } from "./config";
import { clientLog } from "./logger";

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface NextFetchOptions {
  revalidate?: number;
  tags?: string[];
}

export interface RequestOptions<TBody> {
  method?: HttpMethod;
  body?: TBody;
  token?: string;
  cache?: RequestCache;
  next?: NextFetchOptions;
}

let refreshPromise: Promise<boolean> | null = null;

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

function getApiOrigin(): string {
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

function buildApiUrl(path: string): string {
  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const origin = getApiOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const targetPath = normalized === "/api" || normalized.startsWith("/api/") ? normalized : `/api${normalized}`;

  if (!origin) {
    return targetPath;
  }

  return `${origin}${targetPath}`;
}

export { API_BASE_URL, buildApiUrl };

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        credentials: "include"
      });

      if (!response.ok) {
        useSessionStore.getState().setSessionExpired(true);
        return false;
      }

      const payload = (await response.json()) as ApiSuccess<{ accessToken: string; userId: string; role: Role }> | ApiError;
      if (!payload || payload.success !== true) {
        useSessionStore.getState().setSessionExpired(true);
        return false;
      }

      useSessionStore.getState().updateAccessToken(payload.data.accessToken, payload.data.userId, payload.data.role);
      return true;
    } catch (error) {
      clientLog("error", "Token refresh attempt failed", error);
      return false;
    } finally {
      if (!useSessionStore.getState().accessToken) {
        useSessionStore.getState().setSessionExpired(true);
      } else {
        useSessionStore.getState().setSessionExpired(false);
      }
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function ensureAccessToken(): Promise<boolean> {
  const state = useSessionStore.getState();
  if (state.accessToken) {
    return true;
  }
  return refreshAccessToken();
}

export async function apiFetch<TResponse, TBody = unknown>(
  input: string,
  options: RequestOptions<TBody> = {},
  allowRefresh = true
): Promise<TResponse> {
  const { method = "GET", body, token, cache, next } = options;

  let response: Response;
  try {
    response = await fetch(buildApiUrl(input), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      cache,
      next
    });
  } catch (error) {
    clientLog("error", "API request failed", error);
    throw new Error("Cannot reach the Skylive server. Check that the backend is running and try again.");
  }

  let payload: ApiSuccess<TResponse> | ApiError | null = null;
  try {
    payload = (await response.json()) as ApiSuccess<TResponse> | ApiError;
  } catch {
    payload = null;
  }

  const isSuccessPayload = (data: ApiSuccess<TResponse> | ApiError | null): data is ApiSuccess<TResponse> =>
    Boolean(data && data.success === true);
  const isErrorPayload = (data: ApiSuccess<TResponse> | ApiError | null): data is ApiError =>
    Boolean(data && data.success === false);

  if (response.status === 401) {
    if (allowRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const latestAccessToken = useSessionStore.getState().accessToken ?? undefined;
        return apiFetch<TResponse, TBody>(
          input,
          {
            ...options,
            token: latestAccessToken
          },
          false
        );
      }
    }

    if (typeof window !== "undefined") {
      useSessionStore.getState().markSessionExpired();
    }
    const message = isErrorPayload(payload) ? payload.error : "Session expired or unauthorized. Please sign in again.";
    throw new ApiClientError(message, response.status, isErrorPayload(payload) ? payload.code : undefined);
  }

  if (isSuccessPayload(payload)) {
    return payload.data;
  }

  if (!response.ok) {
    const message = isErrorPayload(payload) ? payload.error : `Request failed with status ${response.status}`;
    throw new ApiClientError(message, response.status, isErrorPayload(payload) ? payload.code : undefined);
  }

  if (!payload) {
    return undefined as TResponse;
  }

  if (isErrorPayload(payload)) {
    throw new ApiClientError(payload.error ?? "Unknown error", response.status, payload.code);
  }

  return (payload as ApiSuccess<TResponse>).data;
}
