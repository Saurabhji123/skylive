import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/rooms/create", label: "Create Room" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/careers", label: "Careers" },
      { href: "/contact", label: "Contact" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/security", label: "Security" }
    ]
  }
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/70 text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-3 text-2xl font-semibold uppercase tracking-[0.6em] text-transparent"
            >
              <span className="bg-linear-to-r from-skylive-cyan via-white to-skylive-magenta bg-clip-text text-transparent">
                Skylive
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-white/70">
              Host cinematic watch parties in real time with zero friction collaboration and vibrant communities.
            </p>
          </div>
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-white/60">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition hover:text-skylive-cyan">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-6 text-sm text-white/60 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Skylive Cinema. All rights reserved.</p>
          <span className="text-white/50">Social channels coming soon.</span>
        </div>
      </div>
    </footer>
  );
}
