export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Privacy</p>
        <h1 className="text-4xl font-semibold">Skylive Cinema Privacy Policy</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          We collect the minimum amount of data required to power synchronized, secure watch parties.
        </p>
      </header>

      <section className="space-y-4 text-sm text-white/70">
        <div>
          <h2 className="text-lg font-semibold text-white">What we store</h2>
          <p>
            Profile details (name, avatar, timezone) and preference toggles are persisted in MongoDB Atlas. Room metrics such as guest counts and latency averages are aggregated for analytics.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Media streams</h2>
          <p>
            Live audio and video use WebRTC and are not archived unless hosts enable recording. When enabled, recordings are encrypted at rest and follow your integration preferences for cloud backups.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Your controls</h2>
          <p>
            Visit the settings page to tune notifications, analytics sharing, and integrations. You may request account deletion at any time by emailing skylivecinema@gmail.com.
          </p>
        </div>
      </section>
    </main>
  );
}
