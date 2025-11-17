"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { LinkButton } from "@/components/ui/link-button";

const mockMetrics = [
  { label: "Average watch time", value: "1h 42m" },
  { label: "Peak concurrent viewers", value: "86" },
  { label: "Sessions hosted", value: "12" },
  { label: "Guest satisfaction", value: "97%" }
];

export default function AnalyticsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16 text-white">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Analytics</p>
        <h1 className="text-4xl font-semibold">Understand your cinematic footprint</h1>
        <p className="text-white/60">Insights update once the live metrics service is connected to the backend pipeline.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {mockMetrics.map((metric) => (
          <GlassCard key={metric.label} className="space-y-2 bg-white/10">
            <p className="text-xs uppercase tracking-wide text-white/50">{metric.label}</p>
            <p className="text-2xl font-semibold">{metric.value}</p>
          </GlassCard>
        ))}
      </section>

      <GlassCard className="space-y-4 bg-white/10">
        <h2 className="text-2xl font-semibold">Upcoming dashboards</h2>
        <p className="text-sm text-white/70">
          Real-time bitrate charts, device performance breakdowns, and session retention cohorts will live here. For now,
          use the dashboard network heartbeat and session log exports while we finalize backend aggregation.
        </p>
        <LinkButton href="/dashboard" subtle hideArrow>
          Return to dashboard
        </LinkButton>
      </GlassCard>
    </main>
  );
}
