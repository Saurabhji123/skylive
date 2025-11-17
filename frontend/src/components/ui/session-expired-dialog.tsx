"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useSessionStore } from "@/store/session-store";

export function SessionExpiredDialog() {
  const router = useRouter();
  const { sessionExpired, setSessionExpired } = useSessionStore((state) => ({
    sessionExpired: state.sessionExpired,
    setSessionExpired: state.setSessionExpired
  }));
  if (!sessionExpired) {
    return null;
  }

  const handleDismiss = () => {
    setSessionExpired(false);
  };

  const handleLogin = () => {
    setSessionExpired(false);
    router.push("/auth/login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <GlassCard className="w-full max-w-md space-y-6 bg-white/10 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Session expired</h2>
          <p className="text-sm text-white/70">
            Your authentication token is no longer valid. Please sign in again to continue hosting or joining rooms.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="ghost" onClick={handleDismiss}>
            Stay here
          </Button>
          <Button onClick={handleLogin}>Go to login</Button>
        </div>
      </GlassCard>
    </div>
  );
}
