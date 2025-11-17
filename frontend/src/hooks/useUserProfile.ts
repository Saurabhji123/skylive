"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@skylive/shared";
import { apiFetch, ApiClientError, ensureAccessToken } from "@/lib/api-client";
import { useSession } from "@/hooks/useSession";

interface UseUserProfileOptions {
  redirectTo?: string;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setProfile: Dispatch<SetStateAction<UserProfile | null>>;
  accessToken?: string;
}

export function useUserProfile(options: UseUserProfileOptions = {}): UseUserProfileResult {
  const router = useRouter();
  const { accessToken, isHydrated } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attemptedRefresh = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch<UserProfile>("/user/profile", { token: accessToken });
      setProfile(data);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Unable to load your profile right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      let cancelled = false;

      const attempt = async () => {
        if (!attemptedRefresh.current) {
          attemptedRefresh.current = true;
          setIsLoading(true);
          const refreshed = await ensureAccessToken();
          if (cancelled) {
            return;
          }
          if (refreshed) {
            return;
          }
        }

        setProfile(null);
        setIsLoading(false);
        if (options.redirectTo) {
          const next = encodeURIComponent(options.redirectTo);
          router.replace(`/auth/login?next=${next}`);
        }
      };

      void attempt();

      return () => {
        cancelled = true;
      };
    }

    attemptedRefresh.current = false;
    void fetchProfile();
  }, [accessToken, fetchProfile, isHydrated, options.redirectTo, router]);

  return {
    profile,
    isLoading,
    error,
    refresh: fetchProfile,
    setProfile,
    accessToken
  };
}
