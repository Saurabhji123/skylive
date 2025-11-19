export const API_BASE_URL = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/?$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }

  return "";
})();

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID);
