import { authenticate, unauthorized } from "@/lib/api-auth";
import type { DeviceRecord, MessageRecord } from "@/types/pb";

// Route handlers must run per-request, never cached.
export const dynamic = "force-dynamic";

const MAX_BATCH = 100;
// A message claimed as "sending" but not reported within this window is
// considered stuck and re-queued to "pending" on the next poll.
const SENDING_TIMEOUT_MS = 3 * 60 * 1000;

// PocketBase stores/compares datetimes as "YYYY-MM-DD HH:MM:SS.sssZ".
function pbDate(d: Date) {
  return d.toISOString().replace("T", " ");
}

// GET /outgoing -> [{ id, to, body, sim }]
// The phone polls this with its API key to pick up queued messages.
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { pb, apiKey } = auth;

  try {
    const now = new Date();
    const nowStr = pbDate(now);
    const sinceStr = pbDate(new Date(now.getTime() - 60_000));

    const devices = await pb.collection("devices").getFullList<DeviceRecord>({
      filter: `api_key = "${apiKey.id}"`,
    });

    // Mark the phone as alive (all SIM records share one physical device).
    await Promise.allSettled(
      devices.map((d) =>
        pb.collection("devices").update(d.id, { last_seen: nowStr })
      )
    );

    if (devices.length === 0) return Response.json([]);

    // Recover stuck "sending" messages: claimed by a previous poll but never
    // reported (app killed / lost network mid-send). After a grace period put
    // them back to "pending" so they get retried instead of hanging forever.
    const staleStr = pbDate(new Date(now.getTime() - SENDING_TIMEOUT_MS));
    const stale = await pb.collection("messages").getFullList<MessageRecord>({
      filter: `device.api_key = "${apiKey.id}" && status = "sending" && updated <= "${staleStr}"`,
    });
    await Promise.allSettled(
      stale.map((m) =>
        pb.collection("messages").update(m.id, { status: "pending" })
      )
    );

    // Promote any scheduled messages that are now due.
    const due = await pb.collection("messages").getFullList<MessageRecord>({
      filter: `device.api_key = "${apiKey.id}" && status = "scheduled" && send_at != "" && send_at <= "${nowStr}"`,
    });
    await Promise.allSettled(
      due.map((m) => pb.collection("messages").update(m.id, { status: "pending" }))
    );

    const out: { id: string; to: string; body: string; sim: number | null }[] =
      [];

    for (const d of devices) {
      const rate = d.rate_limit_per_min ?? 0;
      let allowance = MAX_BATCH;

      if (rate > 0) {
        const recent = await pb.collection("messages").getList<MessageRecord>(
          1,
          1,
          {
            filter: `device = "${d.id}" && (status = "sent" || status = "sending") && updated >= "${sinceStr}"`,
            fields: "id",
          }
        );
        allowance = Math.max(0, rate - recent.totalItems);
      }
      if (allowance <= 0) continue;

      const pending = await pb.collection("messages").getList<MessageRecord>(
        1,
        Math.min(allowance, MAX_BATCH),
        {
          filter: `device = "${d.id}" && status = "pending"`,
          sort: "created",
        }
      );

      for (const m of pending.items) {
        // Claim the message so an overlapping poll can't grab it again.
        try {
          await pb.collection("messages").update(m.id, { status: "sending" });
          out.push({
            id: m.id,
            to: m.to ?? "",
            body: m.body,
            sim: m.sim ?? null,
          });
        } catch {
          // Someone else claimed it in the meantime; skip.
        }
      }
    }

    return Response.json(out);
  } catch (err) {
    console.error("/outgoing error", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
