import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GridBackground } from "@/components/GridBackground";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#00F0FF",
};

export const metadata: Metadata = {
  title: "Pitch in Public | Where Founders Get Real Feedback",
  description:
    "Share your startup pitch, get brutally honest feedback from founders and investors. Iterate in public, build better.",
  keywords: ["startup", "pitch", "feedback", "founders", "investors", "MVP"],
  authors: [{ name: "Pitch in Public" }],
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
        className="font-body antialiased bg-slate-950 text-slate-100 min-h-screen"
      >
        <GridBackground />
        <ErrorBoundary>
          <AuthProvider>
            <main className="relative z-10">{children}</main>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
