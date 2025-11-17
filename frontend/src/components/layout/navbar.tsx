"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useSignOut } from "@/hooks/useSignOut";
import { ProfileMenu } from "@/components/layout/profile-menu";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/rooms/create", label: "Create Room" },
  { href: "/rooms/join", label: "Join" }
];

export function Navbar() {
  const pathname = usePathname();
  const { accessToken, displayName, avatarUrl } = useSession();
  const { signOut } = useSignOut();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);
  const initials = displayName?.split(" ").map((part) => part.charAt(0)).join("")?.slice(0, 2).toUpperCase() ?? "SK";

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 text-white">
        <Link
          href="/"
          className="flex items-center gap-3 text-2xl font-semibold uppercase tracking-[0.6em] text-transparent"
          onClick={closeMenu}
        >
          <span className="bg-linear-to-r from-skylive-cyan via-white to-skylive-magenta bg-clip-text text-transparent">
            Skylive
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition hover:text-skylive-cyan",
                  isActive ? "text-skylive-cyan" : "text-white/70"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {accessToken ? (
            <>
              <ProfileMenu initials={initials} avatarUrl={avatarUrl} />
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="text-white/80">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 p-2 text-white md:hidden"
          onClick={toggleMenu}
          aria-label="Toggle navigation"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {isOpen ? (
        <div className="border-t border-white/10 bg-black/80 md:hidden">
          <nav className="flex flex-col gap-3 px-6 py-4 text-sm">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={cn(
                    "rounded-xl px-3 py-2",
                    isActive ? "bg-white/10 text-skylive-cyan" : "text-white/80 hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2">
              {accessToken ? (
                <>
                  <Link href="/profile" onClick={closeMenu} className="rounded-xl bg-white/5 px-3 py-2 text-center">
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      void signOut();
                    }}
                    className="rounded-xl border border-white/10 px-3 py-2 text-center text-white/80"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" onClick={closeMenu} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                    Sign in
                  </Link>
                  <Link href="/auth/register" onClick={closeMenu} className="rounded-xl bg-skylive-cyan px-3 py-2 text-center text-black">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
