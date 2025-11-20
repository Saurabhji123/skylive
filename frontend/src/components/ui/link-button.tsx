"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  subtle?: boolean;
  children: ReactNode;
  hideArrow?: boolean;
}

const baseClasses =
  "group inline-flex items-center justify-between gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylive-cyan/70";

export function LinkButton({ href, subtle = false, className, children, hideArrow = false, ...props }: LinkButtonProps) {
  const styles = cn(
    baseClasses,
    subtle
      ? "border-white/15 bg-white/10 text-white/80 shadow-sm hover:border-skylive-cyan/50 hover:bg-skylive-cyan/15 hover:text-white"
      : "border-skylive-cyan/50 bg-linear-to-r from-skylive-cyan/30 via-skylive-magenta/20 to-transparent text-white shadow-glow hover:-translate-y-0.5 hover:border-skylive-cyan hover:from-skylive-cyan/50 hover:via-skylive-magenta/40",
    className
  );

  const arrow = hideArrow ? null : (
    <span aria-hidden className="text-base text-skylive-cyan transition group-hover:translate-x-1 group-hover:text-white">
      →
    </span>
  );

  const content = (
    <>
      <span>{children}</span>
      {arrow}
    </>
  );

  const isExternal = /^https?:/i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");

  if (isExternal) {
    return (
      <a href={href} className={styles} target="_blank" rel="noopener noreferrer" {...props}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={styles} prefetch={true} {...props}>
      {content}
    </Link>
  );
}
