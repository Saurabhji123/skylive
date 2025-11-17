import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Contact</p>
        <h1 className="text-4xl font-semibold">We would love to hear from you</h1>
        <p className="mx-auto max-w-2xl text-white/70">
          Whether you are hosting premieres or classroom screenings, our team can help you craft the perfect watch experience.
        </p>
      </header>

      <GlassCard className="space-y-4 bg-white/10 p-8 text-sm text-white/70">
        <div>
          <p className="font-semibold text-white">Email</p>
          <p>skylivecinema@gmail.com</p>
        </div>
        <div>
          <p className="font-semibold text-white">Creator partnerships</p>
          <p>skylivecinema@gmail.com</p>
        </div>
        <div>
          <p className="font-semibold text-white">Community</p>
          <Link href="https://discord.gg" className="text-skylive-cyan hover:text-white">
            Join our Discord (invite only during beta)
          </Link>
        </div>
      </GlassCard>
    </main>
  );
}
