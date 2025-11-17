import type { SVGProps } from "react";

export function ClapperboardIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
      {...props}
    >
      <path d="M4 9.5h16v8.75A1.75 1.75 0 0118.25 20h-12.5A1.75 1.75 0 014 18.25z" />
      <path d="M4 9.5l2.4-5.4a1.4 1.4 0 011.28-.83H20l-2.4 6.23" />
      <path d="M7.9 3.27l2.7 6.23" />
      <path d="M12.8 3.27l2.7 6.23" />
    </svg>
  );
}
