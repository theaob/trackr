import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Trackr - Agile Project Management",
  description: "High-performance agile project management and issue tracking platform",
  icons: {
    icon: "/icon.svg",
  },
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
    <html lang="en">
      <body className="font-sans antialiased text-jira-navy bg-white">
        <UserProvider sessionUser={sessionUser}>{children}</UserProvider>
      </body>
    </html>
  );
}
