import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white",
        "placeholder:text-white/50 focus:border-skylive-cyan focus:outline-none focus:ring-2 focus:ring-skylive-cyan/40",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
