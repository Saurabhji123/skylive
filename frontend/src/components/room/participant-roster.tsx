"use client";

import { useMemo } from "react";
import type { RoomParticipantSummary } from "@skylive/shared";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

interface ParticipantRosterProps {
  participants: RoomParticipantSummary[];
  hostId?: string | null;
  presenterId?: string | null;
  currentUserId: string;
  isHost: boolean;
  busyUserId?: string | null;
  feedback?: string | null;
  onSetPresenter?: (participantId: string) => void;
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
}

export function ParticipantRoster({
  participants,
  hostId,
  presenterId,
  currentUserId,
  isHost,
  busyUserId,
  feedback,
  onSetPresenter,
  onMuteParticipant,
  onRemoveParticipant
}: ParticipantRosterProps) {
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }),
    []
  );

  const renderBadges = (participant: RoomParticipantSummary) => {
    const badges: string[] = [];
    if (participant.userId === hostId) {
      badges.push("Host");
    }
    if (participant.userId === presenterId) {
      badges.push("Presenter");
    }
    if (participant.userId === currentUserId) {
      badges.push("You");
    }
    return badges;
  };

  return (
    <GlassCard className="flex flex-col gap-4 border-white/12 bg-white/5">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Participants</h2>
        <span className="text-xs text-white/60">{participants.length}</span>
      </header>
      <div className="space-y-3 text-sm">
        {participants.length === 0 ? (
          <p className="text-white/60">Waiting for others to join.</p>
        ) : (
          participants.map((participant) => {
            const badges = renderBadges(participant);
            const isSelf = participant.userId === currentUserId;
            const disableActions = Boolean(busyUserId && busyUserId === participant.userId);
            return (
              <div
                key={participant.userId}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {participant.displayName ?? participant.userId}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-white/50">
                      {badges.map((badge) => (
                        <span key={badge} className="rounded-full bg-white/10 px-2 py-0.5">
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-white/40">
                    {participant.joinedAt ? timeFormatter.format(new Date(participant.joinedAt)) : ""}
                  </span>
                </div>
                {isHost && !isSelf ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/15"
                      disabled={disableActions}
                      onClick={() => onSetPresenter?.(participant.userId)}
                    >
                      Make presenter
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-white/15"
                      disabled={disableActions}
                      onClick={() => onMuteParticipant?.(participant.userId)}
                    >
                      Mute mic
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-red-300/40 text-red-200 hover:bg-red-500/10"
                      disabled={disableActions}
                      onClick={() => onRemoveParticipant?.(participant.userId)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {feedback ? <p className="text-xs text-amber-200">{feedback}</p> : null}
    </GlassCard>
  );
}
