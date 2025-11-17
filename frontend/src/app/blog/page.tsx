import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

const posts = [
  {
    slug: "launch-notes-2025",
    title: "Launch notes: adaptive scenes & heartbeat sync",
    excerpt: "A deep dive into how we keep Skylive rooms aligned even when networks wobble.",
    date: "Nov 2, 2025"
  },
  {
    slug: "creator-workflows",
    title: "Creator workflows that shine in Skylive",
    excerpt: "How reviewers, clubs, and classrooms use cinematic layouts to tell better stories.",
    date: "Oct 12, 2025"
  }
];

export default function BlogPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-28 text-white">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Blog</p>
        <h1 className="text-4xl font-semibold">Product notes & behind the scenes</h1>
        <p className="mx-auto max-w-3xl text-white/70">
          Engineering stories, roadmap previews, and tips for hosting unforgettable watch parties.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <GlassCard key={post.slug} className="flex flex-col justify-between bg-black/40 p-6">
            <div className="space-y-3">
              <p className="text-xs text-white/50">{post.date}</p>
              <h2 className="text-2xl font-semibold text-white">{post.title}</h2>
              <p className="text-sm text-white/70">{post.excerpt}</p>
            </div>
            <Link href={`/blog/${post.slug}`} className="mt-6 text-sm text-skylive-cyan hover:text-white">
              Read more (coming soon)
            </Link>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}
