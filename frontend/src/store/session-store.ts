import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AvatarAsset } from "@skylive/shared";
import { resolveAvatarUrl } from "@/lib/media";

export type Role = "host" | "guest";

export interface SessionState {
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
  avatar?: AvatarAsset;
  role?: Role;
  accessToken?: string;
  setSession: (session: {
    userId: string;
    displayName: string;
    role: Role;
    accessToken: string;
    avatarUrl?: string;
    avatar?: AvatarAsset;
  }) => void;
  clearSession: () => void;
  markSessionExpired: () => void;
  setSessionExpired: (expired: boolean) => void;
  updateAccessToken: (accessToken: string, userId?: string, role?: Role) => void;
  sessionExpired: boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionExpired: false,
      setSession: (session) =>
        set(() => {
          const rawAvatarPath = session.avatar?.publicPath ?? session.avatarUrl;
          const resolvedAvatarUrl = resolveAvatarUrl(rawAvatarPath);
          const resolvedAvatar: AvatarAsset | undefined = session.avatar
            ? {
                ...session.avatar,
                publicPath: rawAvatarPath ?? session.avatar.publicPath
              }
            : undefined;

          return {
            ...session,
            avatar: resolvedAvatar,
            avatarUrl: resolvedAvatarUrl,
            sessionExpired: false
          };
        }),
      clearSession: () =>
        set({
          userId: undefined,
          displayName: undefined,
          avatarUrl: undefined,
          avatar: undefined,
          role: undefined,
          accessToken: undefined,
          sessionExpired: false
        }),
      markSessionExpired: () =>
        set({
          userId: undefined,
          displayName: undefined,
          avatarUrl: undefined,
          avatar: undefined,
          role: undefined,
          accessToken: undefined,
          sessionExpired: true
        }),
      setSessionExpired: (expired) => set((state) => ({ ...state, sessionExpired: expired })),
      updateAccessToken: (accessToken, userId, role) =>
        set((state) => ({
          ...state,
          accessToken,
          sessionExpired: false,
          ...(userId ? { userId } : {}),
          ...(role ? { role } : {})
        }))
    }),
    {
      name: "skylive-session"
    }
  )
);
