"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn print:hidden">
      Print / Save as PDF
    </button>
  );
}
