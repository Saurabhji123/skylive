import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { ClapperboardIcon } from "@/components/icons/clapperboard";

const featureHighlights = [
  {
    title: "Cinematic Screen Share",
    description: "Stream your desktop, window, or browser tab with synchronized system audio and adaptive bitrate.",
    accent: "Stream"
  },
  {
    title: "Dual Webcam Overlay",
    description: "Floating, draggable camera tiles that stay visible even in fullscreen for authentic reactions.",
    accent: "Overlay"
  },
  {
    title: "Zero Echo Audio",
    description: "Separated mic and system audio pipelines with echo guards for crystal-clear conversations.",
    accent: "Audio"
  }
];

const steps = [
  {
    title: "Create Your Private Theater",
    detail: "Launch a secure room with optional password and invite guests via instant link or QR code."
  },
  {
    title: "Check Devices Effortlessly",
    detail: "Run pre-flight camera, mic, and screen-share tests before anyone steps into the room."
  },
  {
    title: "Share the Moment",
    detail: "Blend screen, webcams, chat, and heartbeat sync to stay perfectly aligned while you watch."
  }
];

const onboarding = [
  {
    title: "How hosts create sessions",
    steps: [
      {
        label: "Sign in or register",
        detail: "Authenticate once—your MongoDB profile keeps preferences and branding synced everywhere."
      },
      {
        label: "Spin up a room",
        detail: "Choose a title, set an optional passcode, and decide on your default streaming quality."
      },
      {
        label: "Invite the crew",
        detail: "Share the room code or generate a one-tap guest link and calendar event from the dashboard."
      }
    ]
  },
  {
    title: "How guests join instantly",
    steps: [
      {
        label: "Open the join page",
        detail: "Head to /rooms/join on any modern browser—no downloads or extensions required."
      },
      {
        label: "Enter the code",
        detail: "Drop in the host’s room code (or follow their magic link) and pick your display name."
      },
      {
        label: "Pass the device check",
        detail: "Verify mic, speakers, and network health with the built-in checker before entering the lounge."
      }
    ]
  }
];

export default function MarketingLanding() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-24 px-6 pb-24 pt-32">
      <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6 text-white">
          <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm uppercase tracking-[0.3em] text-white/60">
            <ClapperboardIcon className="h-5 w-5" />
            <span>Skylive Cinema</span>
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            Share Your Screen. <span className="text-skylive-cyan">Share The Moment.</span>
          </h1>
          <p className="max-w-2xl text-lg text-white/70">
            A browser-only lounge for co-watching, co-commentary, and co-reactions. SKYLIVE CINEMA blends flawless screen
            sharing, dual webcams, and echo-free audio so you can watch and talk together like you are side by side.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/auth/register">
              <Button size="lg" variant="contrast">Start a Watch Room</Button>
            </Link>
            <Link href="/rooms/join">
              <Button size="lg" variant="secondary">
                Join with a Code
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-white/50">
            <div>
              <p className="font-semibold text-white">0 downloads</p>
              <p>Works in Chromium + Firefox</p>
            </div>
            <div>
              <p className="font-semibold text-white">Live audio fences</p>
              <p>Echo-proof mic + screen sound</p>
            </div>
            <div>
              <p className="font-semibold text-white">Room heartbeat</p>
              <p>Live sync & network monitor</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute -inset-1 rounded-[28px] bg-skylive-magenta/40 blur-3xl" />
          <GlassCard className="flex flex-col gap-6 overflow-hidden p-6 sm:p-8">
            <header className="flex flex-col gap-3 text-white/65 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-white/50">Cinematic Preview</p>
                <p className="text-sm text-white/60">Real-time stage mockup</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                  <span>Synced</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <span>Latency · 26 ms</span>
                <span className="hidden sm:inline">•</span>
                <span>00:45 / Live</span>
              </div>
            </header>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="flex h-full flex-col justify-between rounded-3xl border border-white/12 bg-black/60 p-5">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Shared Screen</span>
                  <span>4K / 60 fps</span>
                </div>
                <div className="relative mt-4 flex-1 rounded-2xl bg-linear-to-br from-skylive-magenta/30 via-skylive-cyan/20 to-transparent">
                  <div className="absolute inset-0 rounded-2xl border border-white/10 opacity-40" />
                  <div className="absolute bottom-4 left-4 text-[11px] uppercase tracking-[0.24em] text-white/70">Now streaming</div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                <div className="flex h-32 flex-col justify-between rounded-3xl border border-white/12 bg-black/60 p-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Presenter</span>
                    <span>Pin to stage</span>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/40 text-xs text-white/40">
                    Camera feed waiting
                  </div>
                </div>
                <div className="flex h-32 flex-col justify-between rounded-3xl border border-white/12 bg-black/40 p-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Co-host</span>
                    <span>Muted</span>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/30 text-xs text-white/40">
                    Awaiting join
                  </div>
                </div>
              </div>
            </div>
            <footer className="grid gap-3 text-xs text-white/60 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-skylive-cyan/20 text-sm font-semibold text-skylive-cyan">
                  HDR
                </span>
                <div>
                  <p className="font-semibold text-white">Adaptive pipeline</p>
                  <p className="text-[11px] text-white/60">Syncs host + viewers when bitrate shifts</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-semibold text-emerald-300">
                  QoS
                </span>
                <div>
                  <p className="font-semibold text-white">Network guardrails</p>
                  <p className="text-[11px] text-white/60">Automatically reroutes when jitter spikes</p>
                </div>
              </div>
            </footer>
          </GlassCard>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-3">
        {featureHighlights.map((feature) => (
          <GlassCard key={feature.title} className="space-y-4">
            <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">{feature.accent}</p>
            <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
            <p className="text-base text-white/70">{feature.description}</p>
          </GlassCard>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">How it works</p>
          <h2 className="text-3xl font-semibold text-white">Your watch party in three beats</h2>
          <p className="text-white/70">
            Heartbeat sync and adaptive quality keep your reactions aligned. SKYLIVE automatically tunes video bitrate,
            notifies you of jitter, and re-stitches the stream if your network becomes unstable.
          </p>
        </div>
        <div className="grid gap-4">
          {steps.map((step, index) => (
            <GlassCard key={step.title} className="flex items-start gap-4 bg-white/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-skylive-magenta/70 text-lg font-semibold">
                {index + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-white/70">{step.detail}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-10 text-white">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {onboarding.map((flow) => (
            <div key={flow.title} className="space-y-4">
              <h3 className="text-2xl font-semibold">{flow.title}</h3>
              <ol className="space-y-4 text-sm text-white/70">
                {flow.steps.map((item, index) => (
                  <li key={item.label} className="flex gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-skylive-cyan/20 text-base font-semibold text-skylive-cyan">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-white/70">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-12 text-white">
        <div className="absolute -inset-32 bg-linear-to-tr from-skylive-magenta/20 via-skylive-cyan/20 to-transparent blur-3xl" />
        <div className="relative flex flex-col gap-6 text-center">
          <h2 className="text-4xl font-semibold">Ready for premiere night?</h2>
          <p className="mx-auto max-w-2xl text-lg text-white/70">
            Launch a room, drop a link, and roll film. SKYLIVE CINEMA is built for friends, couples, reviewers, and
            creators who want to talk over every scene without compromising audio or sync.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/rooms/create">
              <Button size="lg" variant="contrast">Host a Watch Party</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="ghost" className="border border-white/20">
                Explore Features
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
