"use client";

import { useEffect, useRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface WebcamOverlayProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  stream?: MediaStream;
  defaultPosition: "top" | "bottom";
  muted?: boolean;
  badge?: string | null;
}

export function WebcamOverlay({ label, stream, defaultPosition, muted = true, badge = "Live", className, ...props }: WebcamOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={cn(
        "group flex w-64 cursor-move flex-col gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 text-white",
        defaultPosition === "top" ? "self-start" : "self-end",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
        <span>{label}</span>
          {badge ? <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-emerald-300">{badge}</span> : null}
      </div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black/30">
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}
