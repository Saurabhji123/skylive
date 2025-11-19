"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { LinkButton } from "@/components/ui/link-button";
import { apiFetch, ensureAccessToken } from "@/lib/api-client";
import { roomStatusTokens } from "@/lib/room-status";
import { useSession } from "@/hooks/useSession";
import type { RoomStats, RoomSummary } from "@skylive/shared";

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, displayName, isHydrated, sessionExpired } = useSession();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      setCheckingSession(true);
      return;
    }

    if (accessToken) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;
    setCheckingSession(true);

    void ensureAccessToken().finally(() => {
      if (cancelled) {
        return;
      }
      setCheckingSession(false);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, isHydrated]);

  const fetchRooms = useCallback(
    async (suppressLoading = false) => {
      if (!accessToken) {
        return;
      }

      if (!suppressLoading) {
        setIsLoading(true);
      }

      try {
        const data = await apiFetch<{ rooms: RoomSummary[]; stats?: RoomStats }>(
          "/rooms?limit=6&includeStats=true",
          {
            method: "GET",
            token: accessToken
          }
        );

        if (!isMountedRef.current) {
          return;
        }

        setRooms(data.rooms);
        setStats(data.stats ?? null);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load rooms");
      } finally {
        if (!isMountedRef.current || suppressLoading) {
          return;
        }
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void fetchRooms();
  }, [accessToken, fetchRooms]);

  const handleSuspend = useCallback(
    async (roomId: string) => {
      if (!accessToken) {
        return;
      }

      setPendingAction(roomId);
      try {
        await apiFetch<{ room: RoomSummary }>(`/rooms/${roomId}`, {
          method: "DELETE",
          token: accessToken
        });
        await fetchRooms(true);
      } catch (err) {
        if (!isMountedRef.current) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to suspend room");
      } finally {
        if (!isMountedRef.current) {
          return;
        }
        setPendingAction(null);
      }
    },
    [accessToken, fetchRooms]
  );

  if (!isHydrated || checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="text-white/70">Loading your room data…</GlassCard>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="space-y-4 bg-white/10 text-center text-white">
          <h1 className="text-2xl font-semibold">
            {sessionExpired ? "Your session timed out" : "Sign in to access your dashboard"}
          </h1>
          <p className="text-sm text-white/70">
            {sessionExpired
              ? "Log in again to refresh your credentials, then reload the dashboard."
              : "Log in to see your rooms, heartbeat metrics, and create new cinematic sessions."}
          </p>
          <div className="flex justify-center">
            <Button onClick={() => router.push("/auth/login?next=%2Fdashboard")}>Go to login</Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Dashboard</p>
            <h1 className="text-4xl font-semibold text-white">Welcome back, {displayName ?? "Host"}</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/rooms/create">
              <Button size="lg" variant="contrast">Start a movie night</Button>
            </Link>
            <Link href="/rooms/join">
              <Button size="lg" variant="secondary">
                Join with code
              </Button>
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-white/60">
          Manage your rooms, review past sessions, and monitor live network health with Skylive orchestrating every stream
          end to end.
        </p>
      </header>

      {error && (
        <GlassCard className="border border-red-400/40 bg-red-500/10 text-sm text-red-100">
          <p>{error}</p>
          {error.toLowerCase().includes("cannot reach") && (
            <p className="pt-2 text-red-100/80">
              Make sure the backend dev server is running on http://localhost:4000 by executing <code className="rounded bg-black/40 px-2 py-1 text-xs">npm run dev</code> inside <code className="rounded bg-black/40 px-2 py-1 text-xs">backend/</code>.
            </p>
          )}
        </GlassCard>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <GlassCard className="space-y-4 md:col-span-2">
          <h2 className="text-2xl font-semibold">Quick actions</h2>
          <div className="grid gap-3">
            <LinkButton href="/rooms/create" subtle>
              Plan your next screening
            </LinkButton>
            <LinkButton href="/settings" subtle>
              Configure audio routing
            </LinkButton>
            <LinkButton href="/analytics" subtle>
              View recent analytics
            </LinkButton>
          </div>
        </GlassCard>
        <GlassCard className="space-y-4">
          <h2 className="text-2xl font-semibold">Network heartbeat</h2>
          <div className="h-32 rounded-2xl bg-black/60" />
          <p className="text-sm text-white/60">Live jitter + RTT from your most recent session.</p>
        </GlassCard>
        <GlassCard className="space-y-4 md:col-span-3">
          <h2 className="text-2xl font-semibold">Session overview</h2>
          {stats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatPanel label="Total rooms" value={stats.total} />
              <StatPanel label="Live now" value={stats.live} />
              <StatPanel label="Pending" value={stats.pending} />
              <StatPanel label="Sessions hosted" value={stats.totalSessions} />
            </div>
          ) : (
            <p className="text-sm text-white/60">Host a session to see your cumulative stats at a glance.</p>
          )}
          {stats ? (
            <p className="text-xs text-white/50">
              Completed: {stats.ended} · Suspended: {stats.suspended}
            </p>
          ) : null}
        </GlassCard>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-white">Recent rooms</h2>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/rooms">Show all sessions</LinkButton>
            <LinkButton href="/rooms/create">Create new room</LinkButton>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading && <GlassCard>Loading rooms…</GlassCard>}
          {!isLoading && rooms.length === 0 && <GlassCard>No rooms yet. Create your first cinematic session.</GlassCard>}
          {rooms.map((room) => (
            <GlassCard key={room.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Code · {room.roomCode}</span>
                <span className={`rounded-full px-3 py-1 text-xs ${roomStatusTokens[room.status].className}`}>
                  {roomStatusTokens[room.status].label}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">Room {room.roomCode}</h3>
                <p className="text-sm text-white/60">Created {new Date(room.createdAt).toLocaleString()}</p>
                <p className="text-sm text-white/50">Sessions hosted: {room.sessionCount ?? 0}</p>
                {room.lastActivatedAt ? (
                  <p className="text-xs text-white/40">Last live {new Date(room.lastActivatedAt).toLocaleString()}</p>
                ) : null}
                {room.status === "suspended" && room.deletedAt ? (
                  <p className="text-xs text-red-200/70">Suspended {new Date(room.deletedAt).toLocaleString()}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/rooms/${room.id}`} className="inline-flex">
                  <Button size="sm" disabled={room.status === "suspended"}>
                    Open room
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="border border-white/20"
                  onClick={() => navigator.clipboard.writeText(room.joinLink)}
                  disabled={room.status === "suspended"}
                >
                  Copy link
                </Button>
                {room.status !== "suspended" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-red-500/40 text-red-200 hover:bg-red-500/10"
                    isLoading={pendingAction === room.id}
                    onClick={() => void handleSuspend(room.id)}
                  >
                    Suspend room
                  </Button>
                ) : (
                  <span className="self-center text-xs text-white/50">Suspended by host</span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatPanel({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
