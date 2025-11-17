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

export default function RoomsIndexPage() {
  const router = useRouter();
  const { accessToken, isHydrated, sessionExpired } = useSession();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const isMountedRef = useRef(true);

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

  const fetchRooms = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch<{ rooms: RoomSummary[]; stats?: RoomStats }>("/rooms?limit=0&includeStats=true", {
        method: "GET",
        token: accessToken
      });

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
      setError(err instanceof Error ? err.message : "Unable to load rooms");
    } finally {
      if (!isMountedRef.current) {
        return;
      }
      setIsLoading(false);
    }
  }, [accessToken]);

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
        await fetchRooms();
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
        <GlassCard className="text-white/70">Loading your sessions…</GlassCard>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="space-y-4 bg-white/10 text-center text-white">
          <h1 className="text-2xl font-semibold">{sessionExpired ? "Your session timed out" : "Sign in to manage rooms"}</h1>
          <p className="text-sm text-white/70">
            {sessionExpired
              ? "Log in again to refresh your credentials, then reload the rooms list."
              : "Log in with your host account to review, end, or suspend sessions."}
          </p>
          <div className="flex justify-center">
            <Button onClick={() => router.push("/auth/login?next=%2Frooms")}>Go to login</Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-16">
      <header className="space-y-2 border-b border-white/10 pb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Sessions</p>
        <h1 className="text-4xl font-semibold text-white">All rooms</h1>
        <p className="max-w-3xl text-white/60">
          Review every lounge you have created, see how many times each one has gone live, and suspend retired screens in a
          couple of clicks.
        </p>
      </header>

      {error ? (
        <GlassCard className="border border-red-400/40 bg-red-500/10 text-sm text-red-100">{error}</GlassCard>
      ) : null}

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/dashboard">Back to dashboard</LinkButton>
            <LinkButton href="/rooms/create">Create new room</LinkButton>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatPanel label="Total rooms" value={stats?.total ?? rooms.length} />
          <StatPanel label="Live now" value={stats?.live ?? rooms.filter((room) => room.status === "live").length} />
          <StatPanel label="Pending" value={stats?.pending ?? rooms.filter((room) => room.status === "pending").length} />
          <StatPanel label="Sessions hosted" value={stats?.totalSessions ?? rooms.reduce((sum, room) => sum + (room.sessionCount ?? 0), 0)} />
        </div>
      </section>

      <GlassCard className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Room roster</h2>
          {isLoading ? <span className="text-sm text-white/60">Refreshing…</span> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/70">
            <thead className="uppercase tracking-[0.25em] text-xs text-white/50">
              <tr>
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Sessions</th>
                <th className="px-3 py-3">Last live</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rooms.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-white/50" colSpan={6}>
                    {isLoading ? "Loading rooms…" : "No rooms yet. Create your first cinematic session."}
                  </td>
                </tr>
              ) : (
                rooms.map((room) => {
                  const statusMeta = roomStatusTokens[room.status];
                  const createdLabel = new Date(room.createdAt).toLocaleString();
                  const lastLiveLabel = room.lastActivatedAt ? new Date(room.lastActivatedAt).toLocaleString() : "—";
                  return (
                    <tr key={room.id}>
                      <td className="px-3 py-4 text-white">
                        <div className="font-semibold">{room.roomCode}</div>
                        <div className="text-xs text-white/40">ID · {room.id}</div>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs ${statusMeta.className}`}>{statusMeta.label}</span>
                      </td>
                      <td className="px-3 py-4">{createdLabel}</td>
                      <td className="px-3 py-4">{room.sessionCount ?? 0}</td>
                      <td className="px-3 py-4">{lastLiveLabel}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link href={`/rooms/${room.id}`}>
                            <Button size="sm" disabled={room.status === "suspended"}>
                              Open
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
                            <span className="self-center text-xs text-white/50">Suspended</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
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
