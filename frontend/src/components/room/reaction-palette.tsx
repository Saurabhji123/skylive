import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ReactionDefinition } from "@/components/icons/reaction-icons";

interface ReactionPaletteProps {
  reactions: ReactionDefinition[];
  isOpen: boolean;
  onSelect: (reaction: ReactionDefinition) => void;
  onClose: () => void;
  anchor?: ReactNode;
}

export function ReactionPalette({ reactions, isOpen, onSelect, onClose, anchor }: ReactionPaletteProps) {
  if (!isOpen) {
    return anchor ?? null;
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-end" onClick={onClose}>
      {anchor}
      <div
        className="mb-[90px] flex w-fit flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/75 px-6 py-4 shadow-xl shadow-black/40 backdrop-blur-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">Reactions</div>
        <div className="flex flex-wrap justify-center gap-3">
          {reactions.map((reaction) => (
            <button
              key={reaction.id}
              type="button"
              onClick={() => onSelect(reaction)}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-white/4 text-2xl leading-none transition hover:scale-110 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylive-cyan/70 cursor-pointer",
                reaction.paletteClass
              )}
            >
              <span aria-hidden>{reaction.emoji}</span>
              <span className="sr-only">{reaction.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-xs font-semibold uppercase tracking-[0.28em] text-white/50 transition hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
