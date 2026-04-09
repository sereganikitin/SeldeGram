import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "SeldeGram",
  description: "Простой и быстрый мессенджер",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} antialiased`}>
      <body className="h-[100dvh] flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
