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

interface RegisterResponse {
  userId: string;
  accessToken: string;
  role: "host" | "guest";
  displayName: string;
  avatarUrl?: string;
  avatar?: AvatarAsset;
}

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

  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: { email, password, displayName }
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
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <GlassCard className="w-full max-w-2xl space-y-8 bg-white/10">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Getting started</p>
          <h1 className="text-3xl font-semibold">Create your SKYLIVE profile</h1>
          <p className="text-white/60">Securely set up your host account — ready for Render backend and Vercel frontends.</p>
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
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
            Continue to Skylive
          </Button>
        </form>
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
