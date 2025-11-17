"use client";

import { useCallback, useRef, useState, type JSX } from "react";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  isMicMuted: boolean;
  isCameraMuted: boolean;
  isScreenSharing: boolean;
  isWhiteboardActive?: boolean;
  areReactionsActive?: boolean;
  isRosterVisible?: boolean;
  onToggleMic: () => void | Promise<void>;
  onToggleCamera: () => void | Promise<void>;
  onToggleScreenShare: () => Promise<void>;
  onStopScreenShare: () => Promise<void>;
  onToggleWhiteboard?: () => void | Promise<void>;
  onToggleReactions?: () => void | Promise<void>;
  onToggleRoster?: () => void | Promise<void>;
  onEndSession: () => Promise<void>;
  canEndRoom?: boolean;
  onEndRoom?: () => Promise<void> | void;
  roomEnded?: boolean;
  isMicBusy?: boolean;
  isCameraBusy?: boolean;
  isScreenBusy?: boolean;
  isWhiteboardBusy?: boolean;
}

export function ControlBar({
  isMicMuted,
  isCameraMuted,
  isScreenSharing,
  isWhiteboardActive = false,
  areReactionsActive = false,
  isRosterVisible = true,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onStopScreenShare,
  onToggleWhiteboard,
  onToggleReactions,
  onToggleRoster,
  onEndSession,
  canEndRoom = false,
  onEndRoom,
  roomEnded = false,
  isMicBusy = false,
  isCameraBusy = false,
  isScreenBusy = false,
  isWhiteboardBusy = false
}: ControlBarProps) {
  const controlsDisabled = roomEnded;

  const handleShare = async () => {
    if (controlsDisabled) {
      return;
    }

    if (isScreenSharing) {
      await onStopScreenShare();
    } else {
      await onToggleScreenShare();
    }
  };

  const endAction = canEndRoom && onEndRoom ? onEndRoom : onEndSession;
  const endLabel = canEndRoom && onEndRoom ? "End Room" : roomEnded ? "Leave Room" : "Leave Session";

  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black/70 px-4 py-4 shadow-lg shadow-skylive-magenta/10 backdrop-blur">
      <ControlButton
        label="Toggle microphone"
        active={!isMicMuted}
        onClick={onToggleMic}
        disabled={controlsDisabled || isMicBusy}
        busy={isMicBusy}
        Icon={MicGlyph}
      />
      <ControlButton
        label="Toggle camera"
        active={!isCameraMuted}
        onClick={onToggleCamera}
        disabled={controlsDisabled || isCameraBusy}
        busy={isCameraBusy}
        Icon={VideoGlyph}
      />
      <ControlButton
        label={isScreenSharing ? "Stop screen share" : "Start screen share"}
        active={isScreenSharing}
        onClick={handleShare}
        disabled={controlsDisabled || isScreenBusy}
        busy={isScreenBusy}
        Icon={ScreenGlyph}
      />
      <ControlButton
        label={isWhiteboardActive ? "Close whiteboard" : "Open whiteboard"}
        active={isWhiteboardActive}
        onClick={onToggleWhiteboard}
        disabled={controlsDisabled || !onToggleWhiteboard || isWhiteboardBusy}
        busy={isWhiteboardBusy}
        Icon={WhiteboardGlyph}
      />
      <ControlButton
        label={areReactionsActive ? "Hide reactions" : "Show reactions"}
        active={areReactionsActive}
        onClick={onToggleReactions}
        disabled={controlsDisabled || !onToggleReactions}
        Icon={EmojiGlyph}
      />
      <ControlButton
        label={isRosterVisible ? "Hide participants" : "Show participants"}
        active={isRosterVisible}
        onClick={onToggleRoster}
        disabled={controlsDisabled || !onToggleRoster}
        Icon={UsersGlyph}
      />
      <ControlButton
        label={endLabel}
        variant="danger"
        onClick={endAction}
        disabled={controlsDisabled && !roomEnded}
        Icon={LeaveGlyph}
      />
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  active?: boolean;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  Icon: GlyphComponent;
  variant?: "default" | "danger";
  busy?: boolean;
}

function ControlButton({ label, active = false, onClick, disabled = false, Icon, variant = "default", busy = false }: ControlButtonProps) {
  const isDisabled = disabled || !onClick;
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const showTooltip = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
    }
    hoverTimer.current = window.setTimeout(() => setIsTooltipVisible(true), 1000);
  }, []);

  const hideTooltip = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setIsTooltipVisible(false);
  }, []);

  const className = cn(
    "relative inline-flex h-14 w-14 items-center justify-center rounded-full border text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylive-cyan/70",
    variant === "danger"
      ? active
        ? "border-red-500 bg-red-500/25 text-red-50"
        : "border-red-400/70 bg-black/60 text-red-200 hover:bg-red-500/15"
      : active
        ? "border-skylive-cyan/80 bg-skylive-cyan/25 text-white shadow-[0_10px_38px_rgba(45,212,191,0.25)]"
        : "border-white/15 bg-black/60 text-white/70 hover:border-white/30 hover:text-white",
    isDisabled ? "cursor-not-allowed opacity-45 hover:border-white/15 hover:text-white/70" : "",
    busy && !isDisabled ? "cursor-wait" : ""
  );

  const handleClick = () => {
    if (isDisabled || !onClick) {
      return;
    }
    void onClick();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className={className}
        disabled={isDisabled}
        onClick={handleClick}
        aria-pressed={active}
        aria-busy={busy}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        <span className={cn(busy ? "opacity-0" : "opacity-100", "transition-opacity")}>
          <Icon active={active} />
        </span>
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <SpinnerGlyph />
          </span>
        ) : null}
        <span className="sr-only">{label}</span>
      </button>
      {isTooltipVisible ? (
        <div className="pointer-events-none absolute -top-11 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white shadow-lg">
          {label}
        </div>
      ) : null}
    </div>
  );
}

type GlyphComponent = ({ active }: { active: boolean }) => JSX.Element;

function SpinnerGlyph() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-skylive-cyan"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 3a9 9 0 1 1-6.36 2.64" strokeLinecap="round" />
    </svg>
  );
}

function MicGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 16a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z" fill={active ? "currentColor" : "none"} />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}

function VideoGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="6.5" width="11" height="11" rx="2.5" fill={active ? "currentColor" : "none"} />
      <path d="M15 10.5L20 8v8l-5-2.5v-3Z" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function ScreenGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="3.5" y="5" width="17" height="11.5" rx="2" fill={active ? "currentColor" : "none"} />
      <path d="M9.5 19.5h5" />
      <path d="M12 10l2.5 2.5H9.5Z" fill={active ? "#0f172a" : "none"} />
    </svg>
  );
}

function WhiteboardGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="5.5" width="16" height="11" rx="2" fill={active ? "currentColor" : "none"} />
      <path d="M9 16.5l1-3 6-6 2 2-6 6Z" fill={active ? "#0f172a" : "none"} />
    </svg>
  );
}

function EmojiGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="7" fill={active ? "currentColor" : "none"} />
      <path d="M9 11h.01" strokeWidth={2.2} />
      <path d="M15 11h.01" strokeWidth={2.2} />
      <path d="M9 14c.6 1.1 1.7 1.8 3 1.8s2.4-.7 3-1.8" />
    </svg>
  );
}

function UsersGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M8.5 13.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill={active ? "currentColor" : "none"} />
      <path d="M17 11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M4.5 19a4.5 4.5 0 0 1 8.1-2.7" />
      <path d="M14.5 15.5A4 4 0 0 1 20 19" />
    </svg>
  );
}

function LeaveGlyph({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path
        d="M4.2 10.2C6.3 8.1 9 7 12 7s5.7 1.1 7.8 3.2"
        fill={active ? "currentColor" : "none"}
        opacity={active ? 0.18 : 1}
      />
      <path d="M4.2 10.2C6.3 8.1 9 7 12 7s5.7 1.1 7.8 3.2" />
      <path d="M7.8 16.6L5.6 19.8" />
      <path d="M16.2 16.6l2.2 3.2" />
      <path d="M9.2 13.2l2.8-2.7" />
      <path d="M14.8 13.2l-2.8-2.7" />
    </svg>
  );
}
