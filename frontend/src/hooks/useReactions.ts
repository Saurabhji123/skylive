import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { ReactionEvent, ReactionSendPayload } from "@skylive/shared";
import { REACTION_DEFINITIONS } from "@/components/icons/reaction-icons";

const REACTION_DURATION_MS = 2600;

type ReactionEntry = ReactionEvent & { expiresAt: number };

interface UseReactionsOptions {
  roomId?: string;
  socket?: Socket | null;
  userId?: string;
  displayName?: string;
}

export function useReactions({ roomId, socket }: UseReactionsOptions) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [activeReactions, setActiveReactions] = useState<ReactionEntry[]>([]);
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleReaction = (event: ReactionEvent) => {
      setActiveReactions((prev) => {
        const next = prev
          .filter((entry) => entry.expiresAt > Date.now())
          .concat({ ...event, expiresAt: Date.now() + REACTION_DURATION_MS });
        return next.slice(-30);
      });
    };

    socket.on("reaction:burst", handleReaction);
    return () => {
      socket.off("reaction:burst", handleReaction);
    };
  }, [socket]);

  useEffect(() => {
    if (cleanupTimerRef.current) {
      window.clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    cleanupTimerRef.current = window.setInterval(() => {
      setActiveReactions((prev) => prev.filter((entry) => entry.expiresAt > Date.now()));
    }, 500);

    return () => {
      if (cleanupTimerRef.current) {
        window.clearInterval(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, []);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!socket || !roomId || !emoji) {
        return;
      }

      const payload: ReactionSendPayload = { roomId, emoji };

      socket.emit("reaction:send", payload);
    },
    [roomId, socket],
  );

  const togglePalette = useCallback(() => {
    setIsPaletteOpen((prev) => !prev);
  }, []);

  const closePalette = useCallback(() => {
    setIsPaletteOpen(false);
  }, []);

  const availableReactions = useMemo(() => REACTION_DEFINITIONS, []);

  return {
    isPaletteOpen,
    togglePalette,
    closePalette,
    sendReaction,
    availableReactions,
    reactions: activeReactions,
  };
}
