"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/hooks/useSession";
import type { RoomSummary } from "@skylive/shared";

export default function CreateRoomPage() {
  const router = useRouter();
  const { accessToken, isHydrated, sessionExpired } = useSession();
  const [roomName, setRoomName] = useState("Skylive Premiere");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [allowReactions, setAllowReactions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = Boolean(accessToken) && (!isPrivate || password.length >= 4);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const room = await apiFetch<RoomSummary>("/rooms", {
        method: "POST",
        token: accessToken,
        body: {
          name: roomName,
          isPrivate,
          password: isPrivate ? password : undefined,
          maxParticipants,
          allowReactions
        }
      });

      router.push(`/rooms/${room.id}?from=create`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create room");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="text-white/70">Loading your session…</GlassCard>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="space-y-4 bg-white/10 text-center text-white">
          <h1 className="text-2xl font-semibold">{sessionExpired ? "Your session expired" : "Sign in to create a room"}</h1>
          <p className="text-sm text-white/70">
            {sessionExpired
              ? "Log back in to refresh your host credentials and continue creating your cinematic lounge."
              : "You need a host account before you can launch a SKYLIVE CINEMA room. Log in and we will bring you back here."}
          </p>
          <div className="flex justify-center">
            <Button variant="contrast" onClick={() => router.push(`/auth/login?next=${encodeURIComponent("/rooms/create")}`)}>
              Go to login
            </Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
      <header className="flex flex-col items-center gap-6 text-center">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/rooms" subtle hideArrow>
              Back to rooms
            </LinkButton>
            <LinkButton href="/dashboard" subtle hideArrow>
              Dashboard
            </LinkButton>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-white/60">
            Create room
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-white">Build your cinematic lounge</h1>
          <p className="max-w-2xl text-white/60">
            Shape the room’s identity, decide who gets in, and prime your audience before you hit broadcast.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-white/50">
          <span className="rounded-full border border-white/10 px-3 py-1">Room code minted after creation</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Edit settings later from the room panel</span>
        </div>
      </header>

      <section className="mt-12 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,2.25fr)_minmax(0,1fr)]">
        <GlassCard className="space-y-10 border border-white/10 bg-black/55 p-6 shadow-2xl shadow-black/35 sm:p-8 xl:p-10">
          <form className="flex flex-col gap-10" onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.32em] text-white/50">Room details</p>
                <h2 className="text-2xl font-semibold text-white">Identity & layout</h2>
                <p className="text-sm text-white/60">Give guests a name they will remember and set the initial capacity.</p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-white" htmlFor="roomName">
                    Room title
                  </label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="Skylive Premiere"
                    required
                  />
                  <p className="text-xs text-white/50">Shows on lobbies, invites, and the live overlay banner.</p>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-white">Seat limit</span>
                  <div className="flex flex-wrap gap-2">
                    {[2, 3, 4].map((count) => (
                      <Button
                        key={count}
                        type="button"
                        variant={maxParticipants === count ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setMaxParticipants(count)}
                      >
                        {count} viewers
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-white/50">You can scale beyond 4 seats once studio tiers launch.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/12 bg-white/5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Private access</p>
                    <p className="text-xs text-white/60">Flip the switch to require a passkey before anyone joins.</p>
                  </div>
                  <Switch
                    id="room-privacy"
                    aria-label="Toggle private room"
                    checked={isPrivate}
                    onChange={(event) => setIsPrivate(event.target.checked)}
                  />
                </div>
                {isPrivate ? (
                  <div className="mt-5 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60" htmlFor="password">
                      Passkey
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 4 characters"
                      minLength={4}
                      required
                    />
                    <p className="text-xs text-white/50">Share it with co-hosts or VIP guests ahead of time.</p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/12 bg-white/5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Floating reactions</p>
                    <p className="text-xs text-white/60">Allow emoji bursts to appear over the screening in real time.</p>
                  </div>
                  <Switch
                    id="room-reactions"
                    aria-label="Toggle reactions"
                    checked={allowReactions}
                    onChange={(event) => setAllowReactions(event.target.checked)}
                  />
                </div>
                <p className="mt-5 text-xs text-white/50">Reactions stay subtle and fade automatically so the film remains center stage.</p>
              </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-white/60">
                We will mint the share link and host dashboard the moment you launch.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="ghost" onClick={() => router.push("/rooms")}>Cancel</Button>
                <Button type="submit" size="lg" variant="contrast" disabled={!canSubmit} isLoading={isLoading}>
                  Launch room setup
                </Button>
              </div>
            </div>
          </form>
        </GlassCard>

        <aside className="space-y-6">
          <GlassCard className="space-y-5 border border-white/10 bg-black/60 p-5 sm:p-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Preview</p>
              <h2 className="text-2xl font-semibold text-white">What guests will see</h2>
            </div>
            <RoomPreview
              roomName={roomName}
              isPrivate={isPrivate}
              allowReactions={allowReactions}
              maxParticipants={maxParticipants}
            />
          </GlassCard>
          <GlassCard className="space-y-5 border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Before you go live</p>
              <h3 className="text-lg font-semibold text-white">Quick host checklist</h3>
            </div>
            <ul className="space-y-3 text-sm text-white/70">
              <li>· Run the preflight check to warm up your camera, mic, and speakers.</li>
              <li>· Drop the invite link into your group chat or calendar hold.</li>
              <li>· Pin the presenter in the host panel before you roll trailers.</li>
            </ul>
          </GlassCard>
        </aside>
      </section>
    </main>
  );
}

function RoomPreview({
  roomName,
  isPrivate,
  allowReactions,
  maxParticipants
}: {
  roomName: string;
  isPrivate: boolean;
  allowReactions: boolean;
  maxParticipants: number;
}) {
  const slug = roomName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32) || "new-room";

  const shareUrl = `https://watch.skylive.app/join/${slug}`;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-white/5 to-transparent p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Room title</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{roomName || "Skylive Premiere"}</h3>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
            {isPrivate ? "Private · Passkey required" : "Open to invite link"}
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Seats · {maxParticipants}</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
            {allowReactions ? "Reactions on" : "Reactions off"}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Share link</p>
        <div className="rounded-xl border border-white/10 bg-black/70 p-3">
          <code className="block truncate text-sm text-white/80">{shareUrl}</code>
        </div>
        <p className="text-xs text-white/50">Final join link may include an auto-generated room code.</p>
      </div>
    </div>
  );
}
