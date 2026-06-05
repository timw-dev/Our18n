import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our18n | Local-first Translation Workspace",

  description:
    "Manage, edit, compare, and version your localization files in a fast local-first workspace. Import JSON and JavaScript i18n projects, review changes, create snapshots, and export translations — all directly in your browser.",

  applicationName: "Our18n",

  authors: [
    {
      name: "Timw",
      url: "https://github.com/timw-dev",
    },
  ],
  keywords: [
    "i18n",
    "localization",
    "translation management",
    "translation workspace",
    "translation editor",
    "json editor",
    "local-first",
    "offline translation",
    "internationalization",
    "react i18n",
    "nextjs i18n",
    "language management",
    "spreadsheet translation",
  ],
  openGraph: {
    title: "Our18n v0.3.0 Beta | Local-first Translation Workspace",
    description:
      "A local-first workspace for managing localization files. Import, edit, compare, snapshot, and export translations directly in your browser.",
    url: "https://our18n.vercel.app",
    siteName: "Our18n",
    type: "website",

  },

  manifest: "/manifest.json",
};


// 2. Tách themeColor ra chuẩn Next.js 14+
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", figtree.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}