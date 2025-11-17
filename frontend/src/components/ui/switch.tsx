"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "h-6 w-12 rounded-full border border-white/20 bg-white/10 transition peer-checked:border-skylive-cyan peer-checked:bg-skylive-cyan/30",
          className
        )}
      />
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-6 peer-checked:bg-skylive-cyan" />
    </label>
  );
});

Switch.displayName = "Switch";
