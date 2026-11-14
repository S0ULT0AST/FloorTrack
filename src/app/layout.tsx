import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Syne } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { ThemeScript } from "@/components/theme/theme-controls";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "FloorTrack", template: "%s · FloorTrack" },
  description: "Floor inventory for appliance stores. One company, many sites, no shared spreadsheet.",
  applicationName: "FloorTrack",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FloorTrack", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#101318",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
