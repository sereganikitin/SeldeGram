import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "SeldeGram — Остаемся на связи не смотря ни на что!",
  description:
    "Простой и быстрый мессенджер: личные чаты, группы, каналы, медиа, стикеры, push-уведомления.",
  openGraph: {
    title: "SeldeGram",
    description: "Остаемся на связи не смотря ни на что!",
    url: "https://infoseledka.ru",
    siteName: "SeldeGram",
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream text-ink">{children}</body>
    </html>
  );
}
