import { authenticate, unauthorized } from "@/lib/api-auth";
import type { DeviceRecord } from "@/types/pb";

export const dynamic = "force-dynamic";

// POST /send
//   { to: string | string[], body: string, sim?: number, send_at?: string }
// Enqueues outgoing message(s) for the calling API key's device. Intended for
// external automation (scripts, cron, other apps) using the same bearer key the
// phone uses. The phone then picks them up via GET /outgoing.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { pb, apiKey } = auth;

  let payload: {
    to?: string | string[];
    body?: string;
    sim?: number | string;
    send_at?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const recipients = (
    Array.isArray(payload.to) ? payload.to : [payload.to]
  )
    .map((r) => (typeof r === "string" ? r.trim() : ""))
    .filter(Boolean);

  if (recipients.length === 0) {
    return Response.json({ error: "no_recipients" }, { status: 400 });
  }
  if (!payload.body || !payload.body.trim()) {
    return Response.json({ error: "missing_body" }, { status: 400 });
  }

  const sim =
    payload.sim === undefined || payload.sim === null
      ? undefined
      : Number(payload.sim);

  try {
    const devices = await pb.collection("devices").getFullList<DeviceRecord>({
      filter: `api_key = "${apiKey.id}"`,
      sort: "sim_slot",
    });
    if (devices.length === 0) {
      return Response.json({ error: "no_device" }, { status: 400 });
    }

    // Choose the device: matching SIM if given, else the first one.
    const device =
      (sim !== undefined &&
        devices.find(
          (d) => d.subscription_id === sim || d.sim_slot === sim
        )) ||
      devices[0];
    const targetSim = sim ?? device.subscription_id ?? device.sim_slot;

    // Optional scheduling.
    let sendAt = "";
    let scheduled = false;
    if (payload.send_at) {
      const t = new Date(payload.send_at);
      if (isNaN(t.getTime())) {
        return Response.json({ error: "invalid_send_at" }, { status: 400 });
      }
      if (t.getTime() > Date.now()) {
        sendAt = t.toISOString().replace("T", " ");
        scheduled = true;
      }
    }

    const results = await Promise.allSettled(
      recipients.map((to) =>
        pb.collection("messages").create({
          device: device.id,
          direction: "out",
          to,
          body: payload.body,
          sim: targetSim,
          status: scheduled ? "scheduled" : "pending",
          send_at: sendAt,
        })
      )
    );

    const queued = results.filter((r) => r.status === "fulfilled").length;
    return Response.json({
      ok: true,
      queued,
      failed: results.length - queued,
      scheduled,
      device: device.id,
      sim: targetSim ?? null,
    });
  } catch (err) {
    console.error("/send error", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
