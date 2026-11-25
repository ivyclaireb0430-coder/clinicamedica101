"use client";

import { useEffect, useState } from "react";

// Light/dark switch for the staff app. The choice is saved on this device only (each phone/computer remembers its own).
// The "dark" class is put on <html> before the page paints by the small script in the root layout, so there is no white flash.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing: the switch still works until the page is closed.
    }
  }

  return (
    <button type="button" onClick={toggle} className={className} aria-pressed={dark}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        ) : (
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        )}
      </svg>
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
