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

// 1. Gắn bộ Metadata chuẩn SEO vào đây
export const metadata: Metadata = {
  title: "Our18n(beta) | I18For Our Translator",
  description: "Công cụ quản lý và chỉnh sửa tệp JSON ngôn ngữ (i18n) hoàn toàn offline. Tối ưu trải nghiệm dịch thuật cho Developer và Translator.",
  applicationName: "Our18n",
  authors: [{ name: "Đoàn Minh Hào", url: "https://github.com/doanminhhao" }], // Thay bằng link Github của bạn
  keywords: ["i18n", "localization", "translation editor", "json editor", "local-first"],
  openGraph: {
    title: "Our18n v0.1.0 beta | Local-first I18n Editor",
    description: "Quản lý và chỉnh sửa tệp JSON ngôn ngữ hoàn toàn offline.",
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