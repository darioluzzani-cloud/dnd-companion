import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compagno di Sessione — Marca di Velmora",
  description: "D&D 5e Session Companion",
  manifest: "/manifest.json",
  themeColor: "#0b0814",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Velmora",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
