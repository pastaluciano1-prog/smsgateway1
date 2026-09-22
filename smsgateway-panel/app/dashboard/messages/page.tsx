"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { listMessages, resendMessage, type MessageFilters } from "@/lib/data";
import type { MessageRecord, MessageStatus } from "@/types/pb";

const STATUS_STYLES: Record<MessageStatus, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  received: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  sending: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

const PER_PAGE = 50;

export default function MessagesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState<MessageFilters>({});
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const copyNumbers = async () => {
    const nums = Array.from(
      new Set(
        items.map((m) => (m.direction === "in" ? m.from : m.to)).filter(Boolean)
      )
    );
    try {
      await navigator.clipboard.writeText(nums.join("\n"));
      flash(`Copied ${nums.length} number${nums.length === 1 ? "" : "s"} (this page)`);
    } catch {
      flash("Copy failed");
    }
  };

  const onResend = async (m: MessageRecord) => {
    setResendingId(m.id);
    try {
      await resendMessage(m);
      flash(`Re-queued to ${m.to}`);
      load(page, filters);
    } catch {
      flash("Resend failed");
    } finally {
      setResendingId(null);
    }
  };

  const load = useCallback(
    async (p: number, f: MessageFilters) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await listMessages(user.id, f, p, PER_PAGE);
        setItems(res.items);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load(1, filters);
  }, [load, filters]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: search.trim() || undefined }));
  };

  const setStatus = (status?: MessageStatus) =>
    setFilters((f) => ({ ...f, status }));
  const setDirection = (direction?: "out" | "in") =>
    setFilters((f) => ({ ...f, direction }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Messages
        </h1>
        <div className="flex items-center gap-3">
          {toast && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {toast}
            </span>
          )}
          <span className="text-sm text-zinc-400">{totalItems} total</span>
          <button
            onClick={copyNumbers}
            disabled={items.length === 0}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Copy numbers
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterPills
          label="Direction"
          value={filters.direction}
          options={[
            { v: undefined, l: "All" },
            { v: "out", l: "Outgoing" },
            { v: "in", l: "Incoming" },
          ]}
          onChange={(v) => setDirection(v as "out" | "in" | undefined)}
        />
        <FilterPills
          label="Status"
          value={filters.status}
          options={[
            { v: undefined, l: "All" },
            { v: "pending", l: "Pending" },
            { v: "sent", l: "Sent" },
            { v: "failed", l: "Failed" },
            { v: "received", l: "Received" },
            { v: "scheduled", l: "Scheduled" },
          ]}
          onChange={(v) => setStatus(v as MessageStatus | undefined)}
        />
        <form onSubmit={onSearch} className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number or text…"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
          {filters.search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilters((f) => ({ ...f, search: undefined }));
              }}
              className="text-sm text-zinc-500 hover:underline"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="p-6 text-sm text-zinc-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">No messages match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-2">Dir</th>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Message</th>
                <th className="px-4 py-2">SIM</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-2 text-xs font-medium text-zinc-500">
                    {m.direction === "in" ? "IN" : "OUT"}
                  </td>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                    {m.direction === "in" ? m.from : m.to}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {m.body}
                    {m.error && (
                      <span className="ml-2 text-xs text-red-500">
                        ({m.error})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{m.sim ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[m.status]
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">
                    {new Date(
                      m.status === "scheduled" && m.send_at
                        ? m.send_at
                        : m.created
                    ).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {m.direction === "out" && (
                      <button
                        onClick={() => onResend(m)}
                        disabled={resendingId === m.id}
                        className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {resendingId === m.id ? "…" : "Resend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1, filters)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
          >
            Prev
          </button>
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load(page + 1, filters)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FilterPills<T extends string | undefined>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs font-medium text-zinc-400">{label}:</span>
      {options.map((o) => (
        <button
          key={o.l}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === o.v
              ? "bg-indigo-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
