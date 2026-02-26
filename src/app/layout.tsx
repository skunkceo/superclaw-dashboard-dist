import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthWrapper } from "@/components/AuthWrapper";
import { ConditionalHeader } from "@/components/ConditionalHeader";
import { CommandPalette } from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "SuperClaw Dashboard",
  description: "Monitor and manage your OpenClaw installation",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthWrapper>
          <ConditionalHeader />
          {children}
          <CommandPalette />
        </AuthWrapper>
      </body>
    </html>
  );
}
