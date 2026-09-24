import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { KeyboardShortcutsProvider } from "@/context/KeyboardShortcutsContext";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentUser } from "@/lib/auth/session";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";

// Downloaded at build time and served from this origin: self-hosted installs
// make no request to Google. latin-ext covers Turkish and other European text.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Tamam",
  description: "High-performance agile project management and issue tracking platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: capping it stops people zooming in (WCAG 1.4.4).
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Only the signed-in user is sent to the browser. The full user directory is
  // fetched per page, scoped to what the caller is allowed to see.
  const sessionUser = await getCurrentUser();

  return (
    // The theme script sets data-theme and data-density before the first paint;
    // the server can't know them, so React is told not to compare them.
    <html lang="en" data-density="compact" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="font-sans antialiased text-ink bg-page">
        <UserProvider sessionUser={sessionUser}>
          <ToastProvider>
            <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
