import { GlassCard } from "@/components/ui/glass-card";

const pillars = [
  {
    title: "Encrypted transport",
    detail: "WebRTC DTLS-SRTP secures every audio and video packet. REST APIs sit behind TLS 1.3 with HSTS enforced."
  },
  {
    title: "Document hygiene",
    detail: "MongoDB collections use schema validation, automatic TTL for refresh tokens, and field-level encryption for secrets."
  },
  {
    title: "Operational alerts",
    detail: "We monitor heartbeats, TURN utilization, and Atlas performance to trigger paging before guests are impacted."
  }
];

export default function SecurityPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Security</p>
        <h1 className="text-4xl font-semibold">Security and trust at Skylive</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          From transport encryption to incident response, Skylive is built to keep your screenings safe.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((pillar) => (
          <GlassCard key={pillar.title} className="space-y-3 bg-black/40 p-6">
            <h2 className="text-xl font-semibold">{pillar.title}</h2>
            <p className="text-sm text-white/70">{pillar.detail}</p>
          </GlassCard>
        ))}
      </section>

      <GlassCard className="space-y-3 bg-white/10 p-6 text-sm text-white/70">
        <p className="font-semibold text-white">Security contact</p>
        <p>Email skylivecinema@gmail.com for disclosures. We aim to respond within 48 hours.</p>
      </GlassCard>
    </main>
  );
}
