import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPEC Test Client",
  description: "Test client for SPEC OAuth flow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
