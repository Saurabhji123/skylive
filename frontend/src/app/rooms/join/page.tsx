"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { RoomSummary } from "@skylive/shared";

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetFeedback = () => {
    setError(null);
    setErrorCode(null);
  };

  const lookupRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a valid invite code.");
      setErrorCode(null);
      return;
    }

    setIsLoading(true);
    resetFeedback();
    try {
      const data = await apiFetch<RoomSummary>(`/rooms/code/${code}`);
      setRoom(data);
    } catch (err) {
      const message = resolveRoomLookupError(err);
      setError(message.message);
      setErrorCode(message.code ?? null);
      setRoom(null);
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) return;

    setIsLoading(true);
    resetFeedback();

    try {
      const trimmedName = username.trim();
      if (!trimmedName) {
        setError("Add the name you'd like participants to see.");
        setErrorCode(null);
        setIsLoading(false);
        return;
      }

      if (room.settings.allowPassword && !password.trim()) {
        setError("This room is password protected. Enter the passcode or ask the host for access.");
        setErrorCode("ROOM_PASSWORD_REQUIRED");
        setIsLoading(false);
        return;
      }

      await apiFetch(`/rooms/${room.id}/join`, {
        method: "POST",
        body: {
          username: trimmedName,
          password: password.trim() ? password.trim() : undefined
        }
      });
      router.push(`/rooms/${room.id}?username=${encodeURIComponent(trimmedName)}&guest=true`);
    } catch (err) {
      const message = resolveJoinError(err);
      setError(message.message);
      setErrorCode(message.code ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const onChangeRoomCode = (value: string) => {
    setRoomCode(value.toUpperCase());
    setRoom(null);
    resetFeedback();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Join room</p>
        <h1 className="text-4xl font-semibold text-white">Enter your invite code</h1>
        <p className="text-white/60">No downloads, no uploads — just join straight into the cinematic session.</p>
      </header>

      <GlassCard className="space-y-6 bg-white/10">
        <form className="grid gap-4" onSubmit={room ? joinRoom : (event) => { event.preventDefault(); void lookupRoom(); }}>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="roomCode">
              Room code
            </label>
            <Input
              id="roomCode"
              value={roomCode}
              onChange={(event) => onChangeRoomCode(event.target.value)}
              placeholder="AB12CD"
              required
              maxLength={8}
            />
          </div>
          {room && (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white/80" htmlFor="username">
                Display name
              </label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Guest name"
                required
              />
            </div>
          )}
          {room?.settings.allowPassword && (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white/80" htmlFor="password">
                Room password
              </label>
              <Input id="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          )}
          {error && <ErrorMessage message={error} code={errorCode} />}
          <Button type="submit" size="lg" isLoading={isLoading}>
            {room ? "Enter screening room" : "Validate code"}
          </Button>
        </form>
        {room && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
            <p>Room ready • Host ID: {room.hostId}</p>
            <p>Status: {room.status}</p>
          </div>
        )}
      </GlassCard>
    </main>
  );
}

interface ResolvedError {
  message: string;
  code?: string;
}

const roomLookupCopy: Record<string, string> = {
  ROOM_NOT_FOUND: "We couldn't find a room with that code. Double-check the invite and try again."
};

const joinCopy: Record<string, string> = {
  ROOM_PASSWORD_INVALID: "That password doesn't match. Ask the host to confirm the latest password.",
  ROOM_FULL: "This room is already at capacity. Wait for someone to leave or ask the host to expand the limit.",
  ROOM_ENDED: "This screening has already wrapped up. Check with the host for the next session.",
  ROOM_SUSPENDED: "The host has suspended this room. Ask them to re-activate or send a new invite."
};

function resolveRoomLookupError(error: unknown): ResolvedError {
  if (error instanceof ApiClientError) {
    const message = roomLookupCopy[error.code ?? ""] ?? error.message;
    return { message, code: error.code };
  }

  return {
    message: error instanceof Error ? error.message : "Unable to validate the invite code right now."
  };
}

function resolveJoinError(error: unknown): ResolvedError {
  if (error instanceof ApiClientError) {
    const message = joinCopy[error.code ?? ""] ?? error.message;
    return { message, code: error.code };
  }

  return {
    message: error instanceof Error ? error.message : "Unable to join the room right now."
  };
}

interface ErrorMessageProps {
  message: string;
  code?: string | null;
}

function ErrorMessage({ message, code }: ErrorMessageProps) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      <p>{message}</p>
      {code === "ROOM_FULL" ? (
        <p className="mt-1 text-xs text-red-200/80">If you expected space, ping the host so they can remove idle guests.</p>
      ) : null}
    </div>
  );
}
