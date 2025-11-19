import type { Metadata, Viewport } from "next";
import { Poppins, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionExpiredDialog } from "@/components/ui/session-expired-dialog";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { GoogleAuthProvider } from "@/providers/google-auth-provider";

const headingFont = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body"
});

const monoFont = JetBrains_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "SKYLIVE CINEMA",
  description: "Share your screen and watch together in a cinematic co-watching lounge.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "alternate icon", url: "/favicon.ico" }
  ]
};

export const viewport: Viewport = {
  themeColor: "#1D1233"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="antialiased bg-transparent">
        <GoogleAuthProvider>
          <div className="fixed inset-0 -z-10 bg-linear-to-br from-skylive-purple via-skylive-midnight to-black" />
          <div className="fixed inset-0 -z-10 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(51,224,255,0.25), transparent 45%)" }} />
          <SessionExpiredDialog />
          <Navbar />
          <main className="min-h-screen pt-24 text-white">
            {children}
          </main>
          <Footer />
        </GoogleAuthProvider>
      </body>
    </html>
  );
}
