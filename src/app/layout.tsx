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
    "Daily 60-second pitch practice for founders. Join the early access waitlist at pitchinpublic.io.",
  applicationName: "Pitch in Public",
  keywords: ["startup", "pitch", "feedback", "founders", "investors", "MVP"],
  authors: [{ name: "Pitch in Public" }],
  metadataBase: new URL("https://pitchinpublic.io"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pitch in Public",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/app-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/app-icon.svg" }],
  },
  openGraph: {
    type: "website",
    url: "https://pitchinpublic.io",
    title: "Pitch in Public",
    description: "Daily pitch practice for founders.",
    siteName: "Pitch in Public",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full bg-black">
      <body
        className="h-full min-h-screen overflow-x-hidden bg-black font-body text-slate-100 antialiased"
      >
        <GridBackground />
        <ErrorBoundary>
          <AuthProvider>
            <main className="relative z-10 min-h-screen bg-black">{children}</main>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
