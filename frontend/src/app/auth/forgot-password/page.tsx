"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";

interface ForgotPasswordResponse {
  message?: string;
}

type RequestState = "idle" | "success" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<RequestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
        method: "POST",
        body: { email }
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "We couldn't start the reset flow just now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-black/70 via-black/40 to-transparent px-6 py-16">
      <GlassCard className="w-full max-w-xl space-y-8 bg-white/10 p-10">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Password reset</p>
          <h1 className="text-3xl font-semibold">Send a recovery link</h1>
          <p className="text-white/70">
            Enter the email tied to your Skylive account. We&apos;ll email a secure link so you can create a new password and get
            back to hosting.
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
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          {status === "success" ? (
            <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              If that address matches an account, the reset link is already on its way. Check your inbox (and spam folder) for
              the next steps.
            </p>
          ) : null}
          {status === "error" && error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" variant="contrast" isLoading={isSubmitting}>
            {status === "success" ? "Resend reset email" : "Send reset email"}
          </Button>
        </form>
        <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/auth/login" className="text-skylive-cyan hover:text-white">
            Back to sign in
          </Link>
          <Link href="/auth/register" className="text-white/60 hover:text-white">
            Need a Skylive account?
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
