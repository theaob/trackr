import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { getAllUsers } from "@/lib/actions/projects";

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
  const users = await getAllUsers();

  return (
    <html lang="en">
      <body className="font-sans antialiased text-jira-navy bg-white">
        <UserProvider initialUsers={users as any}>{children}</UserProvider>
      </body>
    </html>
  );
}
