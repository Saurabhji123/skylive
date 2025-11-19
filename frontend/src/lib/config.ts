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

const rawGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_ID = rawGoogleClientId.trim();
export const GOOGLE_AUTH_ENABLED = GOOGLE_CLIENT_ID.length > 0;
