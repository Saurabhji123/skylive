import { GlassCard } from "@/components/ui/glass-card";

const roles = [
  {
    title: "Senior WebRTC Engineer",
    location: "Remote · UTC-8 to UTC+2",
    description: "Design adaptive bitrate algorithms, ship resilient TURN topologies, and iterate on our mesh mixer."
  },
  {
    title: "Product Designer",
    location: "Remote · Anywhere",
    description: "Craft cinematic, access-first interfaces that feel at home in browser tabs and living room TVs."
  }
];

export default function CareersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Careers</p>
        <h1 className="text-4xl font-semibold">Join the Skylive crew</h1>
        <p className="mx-auto max-w-2xl text-white/70">We are building the co-watching stack of the future. Help us deliver cinema-grade experiences to every browser.</p>
      </header>

      <section className="space-y-4">
        {roles.map((role) => (
          <GlassCard key={role.title} className="space-y-3 bg-black/40 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">{role.title}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{role.location}</span>
            </div>
            <p className="text-sm text-white/70">{role.description}</p>
            <p className="text-sm text-white/60">Email skylivecinema@gmail.com with your reel or portfolio.</p>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}
