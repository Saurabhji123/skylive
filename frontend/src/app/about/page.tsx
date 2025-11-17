import { GlassCard } from "@/components/ui/glass-card";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">About</p>
        <h1 className="text-4xl font-semibold">The story behind Skylive Cinema</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          Built by distributed filmmakers who needed a studio-grade co-watching experience without the friction of installs or hardware.
        </p>
      </header>

      <GlassCard className="space-y-4 bg-white/10 p-8">
        <h2 className="text-2xl font-semibold">Our mission</h2>
        <p className="text-sm text-white/70">
          We believe that every screening—whether for friends, reviewers, or production notes—deserves perfect sync and crystal audio. Skylive Cinema pairs browser-native WebRTC pipelines with MongoDB-backed state to keep every device in lockstep.
        </p>
      </GlassCard>

      <section className="grid gap-6 md:grid-cols-2">
        <GlassCard className="space-y-3 bg-black/40 p-6">
          <h3 className="text-xl font-semibold">Global-first crew</h3>
          <p className="text-sm text-white/70">We operate across 5 timezones and test every release on consumer hardware, ensuring accessibility everywhere.</p>
        </GlassCard>
        <GlassCard className="space-y-3 bg-black/40 p-6">
          <h3 className="text-xl font-semibold">Privacy by design</h3>
          <p className="text-sm text-white/70">Sessions are ephemeral, recordings opt-in, and every document is encrypted at rest in MongoDB Atlas.</p>
        </GlassCard>
      </section>

      <GlassCard className="space-y-3 bg-white/10 p-6 text-sm text-white/70">
        <p className="font-semibold text-white">Want to collaborate?</p>
        <p>Email skylivecinema@gmail.com or join our community preview room every Thursday at 18:00 UTC.</p>
      </GlassCard>
    </main>
  );
}
