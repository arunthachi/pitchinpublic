import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { GridBackground } from "@/components/GridBackground";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pitch in Public | Where Founders Get Real Feedback",
  description:
    "Share your startup pitch, get brutally honest feedback from founders and investors. Iterate in public, build better.",
  keywords: ["startup", "pitch", "feedback", "founders", "investors", "MVP"],
  authors: [{ name: "Pitch in Public" }],
  themeColor: "#00F0FF",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    title: "Pitch in Public",
    description: "Where Founders Get Real Feedback",
    siteName: "Pitch in Public",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body antialiased bg-slate-950 text-slate-100 min-h-screen`}
      >
        <GridBackground />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
