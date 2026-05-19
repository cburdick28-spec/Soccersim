import type { Metadata, Viewport } from "next";
import { warmGameplaySchemaValidation } from "@/lib/supabase/gameplaySchema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Manager Online",
  description:
    "Browser-first football management simulation with solo and multiplayer careers.",
  applicationName: "Pocket Manager Online",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await warmGameplaySchemaValidation();

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
