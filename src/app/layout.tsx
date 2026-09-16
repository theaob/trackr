import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { getAllUsers } from "@/lib/actions/projects";

export const metadata: Metadata = {
  title: "Jira Software Clone",
  description: "Agile project management and issue tracking system",
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
