import type { WhiteboardTool } from "@skylive/shared";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<WhiteboardTool, string> = {
  pen: "Pen",
  eraser: "Eraser",
  highlighter: "Highlight",
};

interface WhiteboardToolbarProps {
  tool: WhiteboardTool;
  onToolChange: (tool: WhiteboardTool) => void;
  color: string;
  colors: string[];
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  onClear?: () => void;
  canClear: boolean;
  canAnnotate: boolean;
}

export function WhiteboardToolbar({
  tool,
  onToolChange,
  color,
  colors,
  onColorChange,
  size,
  onSizeChange,
  onClear,
  canClear,
  canAnnotate,
}: WhiteboardToolbarProps) {
  return (
    <div className="flex w-fit flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between gap-6">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Tools</span>
        {canClear && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 transition hover:border-red-300 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["pen", "highlighter", "eraser"] as WhiteboardTool[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => onToolChange(candidate)}
            disabled={!canAnnotate}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylive-cyan/60",
              tool === candidate
                ? "border-skylive-cyan/70 bg-skylive-cyan/15 text-slate-900"
                : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-900",
              !canAnnotate ? "cursor-not-allowed opacity-40" : "",
            )}
          >
            <ToolGlyph tool={candidate} active={tool === candidate} />
            {TOOL_LABELS[candidate]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Colors</span>
        <div className="flex flex-wrap items-center gap-2">
          {colors.map((candidate) => (
            <button
              key={candidate}
              type="button"
              disabled={!canAnnotate}
              onClick={() => onColorChange(candidate)}
              className={cn(
                "relative h-8 w-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                color.toLowerCase() === candidate.toLowerCase()
                  ? "border-slate-900 shadow-[0_0_0_3px_rgba(15,23,42,0.12)]"
                  : "border-slate-200",
                !canAnnotate ? "cursor-not-allowed opacity-40" : "",
              )}
              style={{ backgroundColor: candidate }}
            >
              <span className="sr-only">Select {candidate}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Stroke</span>
        <input
          type="range"
          min={1}
          max={24}
          value={size}
          disabled={!canAnnotate}
          onChange={(event) => onSizeChange(Number(event.target.value))}
          className="w-48 accent-skylive-cyan"
        />
      </div>
    </div>
  );
}

function ToolGlyph({ tool, active }: { tool: WhiteboardTool; active: boolean }) {
  const stroke = active ? "#0891B2" : "#1E293B";
  if (tool === "eraser") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 14.5L12.5 5.5L18.5 11.5L9.5 20.5H4.5L3.5 19.5V14.5Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tool === "highlighter") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 19L9 19L10 20L13 20L16 17L7 8L4 11L4 14" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 21L5 17L16.5 5.5C17.6 4.4 19.4 4.4 20.5 5.5C21.6 6.6 21.6 8.4 20.5 9.5L9 21L4 21Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
