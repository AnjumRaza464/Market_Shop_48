import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SHOP } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: SHOP.name,
    template: `%s · ${SHOP.name}`,
  },
  description: "Commission shop management: party khata, daily pattis, expenses and profit reports.",
  applicationName: SHOP.name,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
