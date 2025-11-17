"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, User, LayoutDashboard } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useSignOut } from "@/hooks/useSignOut";
import { resolveAvatarUrl } from "@/lib/media";

interface ProfileMenuProps {
  initials: string;
  avatarUrl?: string;
}

export function ProfileMenu({ initials, avatarUrl }: ProfileMenuProps) {
  const { displayName } = useSession();
  const { signOut, isSigningOut } = useSignOut();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedAvatarUrl = useMemo(() => resolveAvatarUrl(avatarUrl), [avatarUrl]);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-1.5 text-sm font-medium text-white/90 transition hover:border-white/30"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Account menu"
      >
        {resolvedAvatarUrl ? (
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image
              src={resolvedAvatarUrl}
              alt={displayName ?? "Profile avatar"}
              width={32}
              height={32}
              className="h-full w-full object-cover"
              unoptimized
            />
          </span>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold uppercase">
            {initials}
          </span>
        )}
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-12 w-56 rounded-xl border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur">
          <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
            Signed in as
            <p className="truncate text-sm font-semibold text-white">{displayName ?? "Skylive Host"}</p>
          </div>
          <nav className="mt-2 flex flex-col gap-1 text-sm text-white/80">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-white/70 transition hover:bg-white/10 hover:text-red-300"
              onClick={() => {
                setIsOpen(false);
                void signOut();
              }}
              disabled={isSigningOut}
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
