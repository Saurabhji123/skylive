"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "contrast";

type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-skylive-magenta hover:bg-skylive-cyan text-white shadow-glow transition-all duration-200",
  secondary:
    "bg-transparent text-skylive-cyan border border-skylive-cyan/50 hover:border-skylive-cyan hover:bg-skylive-cyan/10",
  ghost: "bg-transparent text-neutral-200 hover:text-white hover:bg-white/5",
  contrast: "bg-white text-black hover:bg-white/90 shadow-[0_10px_38px_rgba(104,204,255,0.25)]"
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-3 text-lg"
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  isLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-semibold cursor-pointer",
        "focus-visible:ring-2 focus-visible:ring-skylive-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        variantClasses[variant],
        sizeClasses[size],
        disabled || isLoading ? "opacity-60 cursor-not-allowed" : "",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </motion.button>
  );
}
