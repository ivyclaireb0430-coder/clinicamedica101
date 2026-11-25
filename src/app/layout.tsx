import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dark-colors.css";
import "./dark-mode.css";

export const metadata: Metadata = {
  title: "Clinica Medica 101",
  description: "Clinic operating system",
  robots: { index: false, follow: false },
  // Absolute URLs for link previews (e.g. the landing page photo when shared on Facebook).
  metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#24745e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below may add the "dark" class before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before the first paint (see ThemeToggle). */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
