import type { PropsWithChildren } from "react";

declare module "@react-oauth/google" {
  export interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
    refresh_token?: string;
    prompt?: string;
    error?: string;
    error_description?: string;
  }

  export interface CodeResponse {
    code: string;
    scope?: string;
    authuser?: string;
    prompt?: string;
  }

  export interface UseGoogleLoginOptions {
    flow?: "implicit" | "auth-code";
    onSuccess?: (response: TokenResponse | CodeResponse) => void | Promise<void>;
    onError?: (error: unknown) => void;
    scope?: string;
    prompt?: string;
    state?: string;
    ux_mode?: "popup" | "redirect";
  }

  export type UseGoogleLogin = (options: UseGoogleLoginOptions) => (
    overrideConfig?: Record<string, unknown>
  ) => Promise<void> | void;

  export const useGoogleLogin: UseGoogleLogin;

  export interface GoogleOAuthProviderProps extends PropsWithChildren {
    clientId?: string;
    nonce?: string;
    promptMomentNotification?: () => void;
    onScriptLoadError?: (error: ErrorEvent) => void;
  }

  export const GoogleOAuthProvider: (props: GoogleOAuthProviderProps) => JSX.Element;
}
