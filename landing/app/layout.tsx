import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CraboGram — Самый нежный мессенджер",
  description:
    "CraboGram — тёплые чаты, нежные розовые обои и милые стикеры. Остаёмся на связи несмотря ни на что.",
  openGraph: {
    title: "CraboGram — Самый нежный мессенджер",
    description: "Тёплые чаты с заботой о деталях. Остаёмся на связи несмотря ни на что.",
    url: "https://infoseledka.ru",
    siteName: "CraboGram",
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
