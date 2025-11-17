import { GlassCard } from "@/components/ui/glass-card";

const featureGroups = [
  {
    title: "Host controls",
    tagline: "Direct the room like a pro",
    bullets: [
      "Lock scenes to keep guests in perfect sync",
      "Hand off hosting without ending the stream",
      "Trigger spotlight layouts for reactions"
    ]
  },
  {
    title: "Playback intelligence",
    tagline: "Every frame stays aligned",
    bullets: [
      "Heartbeat sync adjusts bitrate per guest",
      "Edge relay nodes keep latency under 40ms",
      "Auto-record to Skylive cloud or your drive"
    ]
  },
  {
    title: "Collaboration",
    tagline: "Keep chat, polls, and notes together",
    bullets: [
      "Threaded chat with slash commands",
      "Live polls and emoji bursts for quick takes",
      "Shared notes that export back to your studio"
    ]
  }
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Features</p>
        <h1 className="text-4xl font-semibold">Everything you need for cinematic watch parties</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          Skylive bundles production-grade streaming controls, synchronized playback, and collaboration tools into a single browser experience.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {featureGroups.map((group) => (
          <GlassCard key={group.title} className="flex flex-col gap-4 bg-white/5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-skylive-cyan/70">{group.tagline}</p>
              <h2 className="mt-2 text-2xl font-semibold">{group.title}</h2>
            </div>
            <ul className="space-y-3 text-sm text-white/70">
              {group.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-skylive-cyan" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </section>

      <GlassCard className="space-y-6 bg-white/10 p-8 text-white">
        <h2 className="text-3xl font-semibold">Coming soon</h2>
        <p className="text-white/70">
          AI-powered highlight reels, real-time subtitle translation, and direct OBS ingest are in private beta. Join the queue to be first in line.
        </p>
        <p className="text-sm text-white/60">Email skylivecinema@gmail.com to request access.</p>
      </GlassCard>
    </main>
  );
}
