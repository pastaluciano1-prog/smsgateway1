"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { listApiKeys, createApiKey } from "@/lib/data";
import KeyCard from "@/components/KeyCard";
import type { ApiKeyRecord } from "@/types/pb";

export default function KeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setKeys(await listApiKeys(user.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !name.trim()) return;
    setCreating(true);
    try {
      const created = await createApiKey(user.id, name.trim());
      setKeys((prev) => [created, ...prev]);
      setName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          API Keys & Devices
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Each key represents one phone. Scan its QR in the app to connect.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="mb-6 flex gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New key name (e.g. Pixel 8 — Home)"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No API keys yet. Create one above to connect your first phone.
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((k) => (
            <KeyCard
              key={k.id}
              apiKey={k}
              onDeleted={(id) =>
                setKeys((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
