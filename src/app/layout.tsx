import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GridBackground } from "@/components/GridBackground";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.pitchinpublic.io";
const siteName = "Pitch in Public";
const siteTitle = "Pitch in Public | Sharpen Your Pitch";
const siteDescription =
  "Daily 60-second pitch practice for founders. Record your pitch, get constructive feedback, and sharpen your message.";
const ogImages = [
  {
    url: `${appUrl}/og-image.png`,
    width: 1200,
    height: 630,
    alt: "Pitch in Public - Sharpen Your Pitch",
  },
  {
    url: `${appUrl}/og-square.png`,
    width: 1200,
    height: 1200,
    alt: "Pitch in Public PiP monogram",
  },
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#00F0FF",
};

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  keywords: ["startup", "pitch", "feedback", "founders", "investors", "MVP"],
  authors: [{ name: siteName }],
  metadataBase: new URL(appUrl),
  alternates: {
    canonical: appUrl,
  },
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
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/app-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/app-icon.svg" }],
  },
  openGraph: {
    type: "website",
    url: appUrl,
    title: siteTitle,
    description: siteDescription,
    siteName,
    images: ogImages,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [`${appUrl}/og-image.png`],
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
