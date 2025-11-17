import { GlassCard } from "@/components/ui/glass-card";
import { LinkButton } from "@/components/ui/link-button";

const pricingTiers = [
  {
    name: "Premiere",
    price: "Free",
    description: "Perfect for duos co-watching the latest release.",
    highlights: [
      "2 simultaneous participants",
      "1080p adaptive screen share",
      "Dual webcam overlay",
      "Live chat + emoji reactions"
    ],
    cta: {
      label: "Start watching",
      href: "/auth/register"
    }
  },
  {
    name: "Director\u2019s Club",
    price: "$14 / month",
    description: "For creators hosting regular watch parties and commentary streams.",
    highlights: [
      "Up to 6 participants",
      "Priority TURN routing",
      "Custom branding + overlays",
      "Session recordings (coming soon)"
    ],
    cta: {
      label: "Upgrade via support",
      href: "mailto:skylivecinema@gmail.com"
    }
  }
];

const faqs = [
  {
    question: "Can guests join without downloading anything?",
    answer:
      "Yes. SKYLIVE CINEMA runs entirely in the browser. Guests click your invite link, run a quick device check, and join instantly."
  },
  {
    question: "Do you support screen audio for movies and games?",
    answer:
      "Chromium browsers and the Skylive capture pipeline allow tab, window, or full-screen sharing with synced system audio at up to 60 fps."
  },
  {
    question: "Is there a limit on room duration?",
    answer:
      "Premiere sessions run up to 4 hours per room. Director\u2019s Club unlocks extended screenings and access to session archives."
  }
];

export default function PricingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 py-16 text-white">
      <header className="space-y-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/60">
          Plans & Pricing
        </span>
        <h1 className="text-4xl font-semibold md:text-5xl">Choose your cinematic cadence</h1>
        <p className="mx-auto max-w-2xl text-base text-white/70">
          Start with Premiere for personal co-watching or step up to the Director\u2019s Club for professional commentary, patrons, and live shows.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-2">
        {pricingTiers.map((tier) => (
          <GlassCard key={tier.name} className="flex h-full flex-col justify-between space-y-6 bg-white/10">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-skylive-cyan/80">{tier.name}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{tier.price}</span>
                  {tier.price !== "Free" && <span className="text-sm text-white/60">billed monthly</span>}
                </div>
                <p className="text-sm text-white/70">{tier.description}</p>
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {tier.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-skylive-cyan" aria-hidden />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4">
              <LinkButton href={tier.cta.href} className="w-full justify-center" hideArrow>
                {tier.cta.label}
              </LinkButton>
            </div>
          </GlassCard>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <GlassCard className="space-y-4 bg-white/10">
          <h2 className="text-2xl font-semibold">Need a studio plan?</h2>
          <p className="text-sm text-white/70">
            Agencies and studios can request bespoke TURN infrastructure, talent onboarding, and analytics dashboards tuned to premiere night.
          </p>
          <LinkButton href="mailto:skylivecinema@gmail.com" className="w-fit border-white/20 bg-white/5 hover:bg-white/10" hideArrow>
            Talk to our team
          </LinkButton>
        </GlassCard>
        <GlassCard className="space-y-4 bg-white/10">
          <h2 className="text-2xl font-semibold">Community roadmap</h2>
          <p className="text-sm text-white/70">
            Screen share overlays, quick scene markers, and dual-track recordings are already in development. Director\u2019s Club members get early access.
          </p>
          <LinkButton
            href="https://skylive.cinema/roadmap"
            className="w-fit border-white/20 bg-white/5 hover:bg-white/10"
            hideArrow
          >
            Peek at what\u2019s launching next
          </LinkButton>
        </GlassCard>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold">Frequently asked</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((faq) => (
            <GlassCard key={faq.question} className="space-y-3 bg-white/10">
              <h3 className="text-lg font-semibold">{faq.question}</h3>
              <p className="text-sm text-white/70">{faq.answer}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </main>
  );
}
