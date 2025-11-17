import { useMemo } from "react";
import type { ReactionEvent } from "@skylive/shared";
import { reactionByEmoji } from "@/components/icons/reaction-icons";
import { cn } from "@/lib/utils";

interface ReactionsOverlayProps {
  reactions: Array<ReactionEvent & { expiresAt: number }>;
}

function randomOffset(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 80);
}

export function ReactionsOverlay({ reactions }: ReactionsOverlayProps) {
  const items = useMemo(() => reactions.slice(-20), [reactions]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {items.map((reaction) => {
        const offset = randomOffset(reaction.id);
        const definition = reactionByEmoji.get(reaction.emoji);
        const emoji = definition?.emoji ?? reaction.emoji;
        return (
          <span
            key={reaction.id}
            className={cn(
              "animate-reaction-bubble absolute bottom-0 will-change-transform [animation-duration:2.6s]",
              definition?.burstClass ?? "text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]"
            )}
            style={{ left: `${offset + 10}%`, animationDelay: "0ms" }}
          >
            <span className="flex h-12 w-12 items-center justify-center text-3xl leading-none sm:text-4xl" aria-hidden>
              {emoji}
            </span>
            <span className="sr-only">{definition?.label ?? emoji}</span>
          </span>
        );
      })}
    </div>
  );
}
