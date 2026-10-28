"use client";

export function PrintButton({ label = "Print / Save as PDF", className = "btn" }: { label?: string; className?: string }) {
  return (
    <button onClick={() => window.print()} className={`${className} print:hidden`}>
      {label}
    </button>
  );
}
