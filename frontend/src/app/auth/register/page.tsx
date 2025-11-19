"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import type { CodeResponse, TokenResponse } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { GOOGLE_AUTH_ENABLED } from "@/lib/config";
import { useSessionStore } from "@/store/session-store";
import { useSession } from "@/hooks/useSession";
import type { AuthSessionPayload } from "@/types/auth";

const isCodeResponse = (response: TokenResponse | CodeResponse): response is CodeResponse =>
  typeof (response as CodeResponse).code === "string" && !!(response as CodeResponse).code;

function RegisterPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <GlassCard className="w-full max-w-2xl space-y-4 bg-white/10 p-10 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/70">Loading</p>
        <p>Preparing your Skylive registration flow…</p>
      </GlassCard>
    </div>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, isHydrated } = useSession();
  const setSession = useSessionStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const applySession = (payload: AuthSessionPayload) => {
    setSession({
      userId: payload.userId,
      displayName: payload.displayName,
      accessToken: payload.accessToken,
      role: payload.role,
      avatarUrl: payload.avatarUrl,
      avatar: payload.avatar
    });

    router.push(safeNext ?? "/");
  };

  const startGoogleRegistration = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (tokenResponse) => {
      if (!isCodeResponse(tokenResponse)) {
        setError("Google sign-in did not return a verification code.");
        return;
      }

      setError(null);
      setIsGoogleLoading(true);
      try {
        const response = await apiFetch<AuthSessionPayload>("/auth/google", {
          method: "POST",
          body: { code: tokenResponse.code }
        });
        applySession(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to complete Google sign-in");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setError("Google sign-in was cancelled. Please try again.");
    }
  });

  useEffect(() => {
    if (!isHydrated || !accessToken) {
      return;
    }
    router.replace(safeNext ?? "/");
  }, [accessToken, isHydrated, router, safeNext]);

  if (!isHydrated) {
    return <RegisterPageFallback />;
  }

  if (accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="w-full max-w-2xl space-y-4 bg-white/10 p-10 text-center text-white">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Already signed in</p>
          <p className="text-white/70">You already have an active Skylive session. Redirecting you to the homepage…</p>
        </GlassCard>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isGoogleLoading) {
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch<AuthSessionPayload>("/auth/register", {
        method: "POST",
        body: { email, password, displayName }
      });
      applySession(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <GlassCard className="w-full max-w-2xl space-y-8 bg-white/10 p-10">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Getting started</p>
          <h1 className="text-3xl font-semibold">Create your SKYLIVE profile</h1>
          <p className="text-white/60">Securely set up your host account and launch cinematic watch parties in minutes.</p>
        </div>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Avery the host"
              disabled={isLoading || isGoogleLoading}
              required
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={isLoading || isGoogleLoading}
              required
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={isLoading || isGoogleLoading}
              required
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="confirmPassword">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={isLoading || isGoogleLoading}
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            variant="contrast"
            isLoading={isLoading}
            loadingText="Creating account..."
            disabled={isGoogleLoading}
          >
            Continue to Skylive
          </Button>
        </form>
        {GOOGLE_AUTH_ENABLED ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-white/50">
              <span className="h-px flex-1 bg-white/20" />
              <span className="text-xs uppercase tracking-[0.3em]">or</span>
              <span className="h-px flex-1 bg-white/20" />
            </div>
            <Button
              type="button"
              size="lg"
              variant="contrast"
              className="w-full gap-3 bg-white text-black hover:bg-white/90 border border-black/10"
              onClick={() => startGoogleRegistration()}
              isLoading={isGoogleLoading}
              loadingText="Connecting..."
              disabled={isLoading || isGoogleLoading}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </div>
        ) : null}
        <p className="text-center text-sm text-white/70">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-skylive-cyan hover:text-white">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.24 10.22v3.74h5.21c-.21 1.3-1.57 3.82-5.21 3.82a6.02 6.02 0 1 1 0-12.05c1.83 0 3.06.77 3.76 1.44l2.66-2.57A9.86 9.86 0 0 0 12.24 2a10 10 0 1 0 0 20c5.75 0 9.56-4.05 9.56-9.75 0-.65-.07-1.15-.16-1.64H12.24Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
