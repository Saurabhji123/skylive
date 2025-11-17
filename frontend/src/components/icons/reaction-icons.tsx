export interface ReactionDefinition {
  id: string;
  emoji: string;
  label: string;
  paletteClass: string;
  burstClass: string;
}

export const REACTION_DEFINITIONS: ReactionDefinition[] = [
  {
    id: "clap",
    emoji: "👏",
    label: "Applause",
    paletteClass: "text-amber-200",
    burstClass: "text-amber-200 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]",
  },
  {
    id: "thumbs-up",
    emoji: "👍",
    label: "Thumbs up",
    paletteClass: "text-sky-200",
    burstClass: "text-sky-200 drop-shadow-[0_0_18px_rgba(125,211,252,0.45)]",
  },
  {
    id: "heart",
    emoji: "❤️",
    label: "Heart",
    paletteClass: "text-rose-200",
    burstClass: "text-rose-200 drop-shadow-[0_0_18px_rgba(251,113,133,0.45)]",
  },
  {
    id: "fire",
    emoji: "🔥",
    label: "Fire",
    paletteClass: "text-orange-200",
    burstClass: "text-orange-200 drop-shadow-[0_0_18px_rgba(253,186,116,0.45)]",
  },
  {
    id: "laugh",
    emoji: "😂",
    label: "Laughing",
    paletteClass: "text-yellow-200",
    burstClass: "text-yellow-200 drop-shadow-[0_0_18px_rgba(250,204,21,0.45)]",
  },
  {
    id: "heart-eyes",
    emoji: "😍",
    label: "Heart eyes",
    paletteClass: "text-pink-200",
    burstClass: "text-pink-200 drop-shadow-[0_0_18px_rgba(244,114,182,0.45)]",
  },
  {
    id: "party",
    emoji: "🎉",
    label: "Celebrate",
    paletteClass: "text-violet-200",
    burstClass: "text-violet-200 drop-shadow-[0_0_18px_rgba(196,181,253,0.45)]",
  },
  {
    id: "mind-blown",
    emoji: "🤯",
    label: "Mind blown",
    paletteClass: "text-indigo-200",
    burstClass: "text-indigo-200 drop-shadow-[0_0_18px_rgba(165,180,252,0.45)]",
  },
  {
    id: "hands-up",
    emoji: "🙌",
    label: "Hands up",
    paletteClass: "text-emerald-200",
    burstClass: "text-emerald-200 drop-shadow-[0_0_18px_rgba(16,185,129,0.45)]",
  },
  {
    id: "sparkle-heart",
    emoji: "💖",
    label: "Sparkle heart",
    paletteClass: "text-fuchsia-200",
    burstClass: "text-fuchsia-200 drop-shadow-[0_0_18px_rgba(232,121,249,0.45)]",
  },
  {
    id: "cool",
    emoji: "😎",
    label: "Too cool",
    paletteClass: "text-blue-200",
    burstClass: "text-blue-200 drop-shadow-[0_0_18px_rgba(96,165,250,0.45)]",
  },
];

export const reactionByEmoji = new Map(REACTION_DEFINITIONS.map((definition) => [definition.emoji, definition]));
