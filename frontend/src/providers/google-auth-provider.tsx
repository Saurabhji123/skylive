"use client";

import { useEffect, type ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GOOGLE_AUTH_ENABLED, GOOGLE_CLIENT_ID } from "@/lib/config";

interface GoogleAuthProviderProps {
  children: ReactNode;
}

export function GoogleAuthProvider({ children }: GoogleAuthProviderProps) {
  const clientId = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 0 ? GOOGLE_CLIENT_ID : "__disabled-google-oauth__";

  useEffect(() => {
    if (!GOOGLE_AUTH_ENABLED && process.env.NODE_ENV !== "production") {
      console.warn("Google Sign-In is disabled: provide NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable it.");
    }
  }, []);

  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Google OAuth script failed to load. Check NEXT_PUBLIC_GOOGLE_CLIENT_ID configuration.");
        }
      }}
    >
      {children}
    </GoogleOAuthProvider>
  );
}
