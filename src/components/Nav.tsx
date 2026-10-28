"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/inbox", label: "Inbox", icon: "M4 4h16v12H5.2L4 17.2zM4 13h4l2 3h4l2-3h4", phone: true },
  { href: "/leads", label: "Leads", icon: "M17 20h5v-2a4 4 0 00-5-3.9M9 20H2v-2a4 4 0 014-4h3a4 4 0 014 4v2zm3-12a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/patients", label: "Patients", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7zM19 3v4m-2-2h4" },
  { href: "/calendar", label: "Calendar", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" },
  { href: "/followups", label: "Follow-up", phone: false, icon: "M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/billing", label: "Billing", phone: false, icon: "M3 7h18v10H3zM3 10h18M7 15h3" },
  { href: "/scripts", label: "Scripts", phone: false, icon: "M8 10h8M8 14h5m-9 6l3-3h10a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14z" },
  { href: "/settings", label: "More", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2.2-1.3L14.3 3h-4l-.4 2.4a7.5 7.5 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 002.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Nav({ userName, inboxCount }: { userName: string; inboxCount: number | null }) {
  const path = usePathname();
  // inboxCount null = no access to Messenger conversations (front desk).
  const items = ITEMS.filter((i) => i.href !== "/inbox" || inboxCount !== null);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 print:!hidden flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="font-semibold text-brand-700">Clinica Medica 101</div>
          <div className="muted truncate">{userName}</div>
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active(item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon d={item.icon} />
              {item.label}
              {item.href === "/inbox" && (inboxCount ?? 0) > 0 && <span className="badge ml-auto bg-amber-400 text-white">{inboxCount}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      {/* Phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex print:hidden border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.filter((item) => item.phone !== false).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active(item.href) ? "text-brand-700" : "text-slate-500"
            }`}
          >
            <Icon d={item.icon} />
            {item.label}
            {item.href === "/inbox" && (inboxCount ?? 0) > 0 && (
              <span className="absolute right-1/4 top-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{inboxCount}</span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
