import type { AvatarAsset } from "@skylive/shared";

export type AuthRole = "host" | "guest";

export interface AuthSessionPayload {
  userId: string;
  accessToken: string;
  role: AuthRole;
  displayName: string;
  avatarUrl?: string;
  avatar?: AvatarAsset;
}
