import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Shell } from "@/components/shell";
import { loadCore } from "@/lib/load";
import "./globals.css";

// Söhne (UI) and Tiempos Headline (editorial), from app/font. These are the "Test" cuts: evaluation only, buy the
// licence before this is public. Weights not listed here are not loaded.
const ui = localFont({
  variable: "--font-ui", display: "swap", fallback: ["system-ui", "sans-serif"],
  src: [
    { path: "../../font/TestSohne-Buch.otf", weight: "400", style: "normal" },
    { path: "../../font/TestSohne-Kraftig.otf", weight: "500", style: "normal" },
    { path: "../../font/TestSohne-Halbfett.otf", weight: "600", style: "normal" },
  ],
});
const editorial = localFont({
  variable: "--font-editorial", display: "swap", fallback: ["Georgia", "serif"],
  src: [
    { path: "../../font/Test Tiempos Collection/Test Tiempos Headline/TestTiemposHeadline-Regular.otf", weight: "400", style: "normal" },
    { path: "../../font/Test Tiempos Collection/Test Tiempos Headline/TestTiemposHeadline-Medium.otf", weight: "500", style: "normal" },
  ],
});
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Creator Studio", description: "A calm workspace for finding and shaping content ideas." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F5F2EC" };

// Data is live per request; nothing here should be prerendered.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const d = await loadCore();
  const mode = !d.connected ? "local" : d.error ? "error" : d.source === "supabase" ? "ok" : "unreachable";
  return (
    <html lang="en" suppressHydrationWarning className={`${ui.variable} ${editorial.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <Shell mode={mode}>{children}</Shell>
      </body>
    </html>
  );
}
