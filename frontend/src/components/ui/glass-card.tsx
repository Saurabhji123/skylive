import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-white",
        "backdrop-blur-xl shadow-lg shadow-black/40",
        className
      )}
      {...props}
    />
  );
}
