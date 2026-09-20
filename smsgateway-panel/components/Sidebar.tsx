"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "▦" },
  { href: "/dashboard/keys", label: "API Keys & Devices", icon: "🔑" },
  { href: "/dashboard/send", label: "Send", icon: "✈" },
  { href: "/dashboard/messages", label: "Messages", icon: "✉" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-5 py-5">
        <div className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          SMS Gateway
        </div>
        <div className="mt-0.5 text-xs text-zinc-400">control panel</div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="truncate px-2 pb-2 text-xs text-zinc-400">
          {user?.email}
        </div>
        <button
          onClick={logOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
