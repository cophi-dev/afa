import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KI-Telefonassistent | Demo für Kleinunternehmen",
  description:
    "Testen Sie unseren intelligenten KI-Telefonassistenten für Zahnarztpraxen, Friseursalons und Handwerksbetriebe. 24/7 erreichbar, professionell und freundlich.",
  keywords: [
    "KI Telefonassistent",
    "Voice AI",
    "Terminvereinbarung",
    "Kleinunternehmen",
    "Chatbot",
    "Grok Voice",
  ],
  openGraph: {
    title: "KI-Telefonassistent Demo",
    description: "Intelligente Telefonassistenten für Kleinunternehmen",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
