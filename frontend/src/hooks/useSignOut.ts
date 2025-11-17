"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { clientLog } from "@/lib/logger";

export function useSignOut() {
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);
  const accessToken = useSessionStore((state) => state.accessToken);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await apiFetch<{ success: boolean }>("/auth/logout", { method: "POST", token: accessToken });
    } catch (error) {
      clientLog("error", "Failed to revoke session on the server", error);
    } finally {
      clearSession();
      setIsSigningOut(false);
      router.push("/auth/login");
    }
  }, [accessToken, clearSession, isSigningOut, router]);

  return { signOut, isSigningOut };
}
