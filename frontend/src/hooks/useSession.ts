"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/store/session-store";
import type { SessionState } from "@/store/session-store";
import { ensureAccessToken } from "@/lib/api-client";

type HydratedSession = SessionState & { isHydrated: boolean };

export function useSession(): HydratedSession {
  const session = useSessionStore((state) => state);
  const persistApi = (useSessionStore as typeof useSessionStore & {
    persist?: {
      hasHydrated?: () => boolean;
      onFinishHydration?: (callback: () => void) => (() => void) | void;
    };
  }).persist;

  const [isHydrated, setIsHydrated] = useState(false);
  const refreshAttemptRef = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | void;

    if (!persistApi) {
      setIsHydrated(true);
      return () => undefined;
    }

    if (persistApi.hasHydrated?.()) {
      setIsHydrated(true);
    } else {
      unsub = persistApi.onFinishHydration?.(() => setIsHydrated(true));
    }

    return () => {
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, [persistApi]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (session.accessToken) {
      refreshAttemptRef.current = false;
      return;
    }

    if (refreshAttemptRef.current) {
      return;
    }

    let isActive = true;
    refreshAttemptRef.current = true;

    void ensureAccessToken().finally(() => {
      if (!isActive && !useSessionStore.getState().accessToken) {
        refreshAttemptRef.current = false;
      }
    });

    return () => {
      isActive = false;
    };
  }, [isHydrated, session.accessToken]);

  return {
    ...session,
    isHydrated
  };
}
