import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compagno di Sessione — Marca di Velmora",
  description: "D&D 5e Session Companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
