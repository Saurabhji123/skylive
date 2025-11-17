"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AvatarAsset } from "@skylive/shared";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { useSession } from "@/hooks/useSession";

interface LoginResponse {
  userId: string;
  displayName: string;
  accessToken: string;
  role: "host" | "guest";
  avatarUrl?: string;
  avatar?: AvatarAsset;
}

function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-black/60 via-black/40 to-transparent px-6 py-16">
      <GlassCard className="w-full max-w-xl space-y-4 bg-white/10 p-10 text-center text-white/70">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/70">Loading</p>
        <p>Preparing your Skylive sign-in experience…</p>
      </GlassCard>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, isHydrated } = useSession();
  const setSession = useSessionStore((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

  useEffect(() => {
    if (!isHydrated || !accessToken) {
      return;
    }

    router.replace(safeNext ?? "/");
  }, [accessToken, isHydrated, router, safeNext]);

  if (!isHydrated) {
    return <LoginPageFallback />;
  }

  if (accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-black/60 via-black/40 to-transparent px-6 py-16">
        <GlassCard className="w-full max-w-xl space-y-4 bg-white/10 p-10 text-center text-white">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Already signed in</p>
          <p className="text-white/70">You&apos;re authenticated. Redirecting you to the Skylive homepage…</p>
        </GlassCard>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password }
      });

      setSession({
        userId: response.userId,
        displayName: response.displayName,
        accessToken: response.accessToken,
        role: response.role,
        avatarUrl: response.avatarUrl,
        avatar: response.avatar
      });

      router.push(safeNext ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-black/60 via-black/40 to-transparent px-6 py-16">
      <GlassCard className="w-full max-w-xl space-y-10 bg-white/10 p-10">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Welcome back</p>
          <h1 className="text-3xl font-semibold">Sign in to Skylive</h1>
          <p className="text-white/70">
            Access your live watch-party dashboard, saved room templates, and device sync history with your host credentials.
          </p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-white/80" htmlFor="email">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-sm font-medium text-white/80" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>
          {error ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" variant="contrast" isLoading={isLoading}>
            Continue to Skylive
          </Button>
        </form>
        <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/auth/register" className="text-skylive-cyan hover:text-white">
            New to Skylive? Create an account
          </Link>
          <Link href="/auth/forgot-password" className="text-white/60 hover:text-white">
            Forgot password?
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
