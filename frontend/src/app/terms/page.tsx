export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Terms</p>
        <h1 className="text-4xl font-semibold">Skylive Cinema Terms of Service</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          Last updated November 16, 2025. These terms outline how you may use Skylive Cinema and our real-time collaboration services.
        </p>
      </header>

      <section className="space-y-4 text-sm text-white/70">
        <div>
          <h2 className="text-lg font-semibold text-white">1. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your login credentials. Activity performed using your account is your responsibility. Hosts must obtain guest consent before recording or storing any session.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">2. Acceptable use</h2>
          <p>
            Skylive is designed for legitimate co-watching and collaboration. Do not upload or stream content that infringes intellectual property or violates applicable law. We reserve the right to suspend accounts that abuse network resources.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">3. Data processing</h2>
          <p>
            MongoDB Atlas stores profile, preference, and session metadata. All media streams flow peer-to-peer or via Skylive relays and are not retained unless you enable recordings. Refer to our privacy policy for more information.
          </p>
        </div>
      </section>
    </main>
  );
}
