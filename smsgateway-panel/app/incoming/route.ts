import { authenticate, unauthorized } from "@/lib/api-auth";
import type { DeviceRecord } from "@/types/pb";

export const dynamic = "force-dynamic";

// POST /incoming  { from, body, sim, timestamp }
// The phone forwards a newly received SMS.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { pb, apiKey } = auth;

  let body: {
    from?: string;
    body?: string;
    sim?: number | string;
    timestamp?: number | string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.body) {
    return Response.json({ error: "missing_body" }, { status: 400 });
  }

  const sim =
    body.sim === undefined || body.sim === null ? undefined : Number(body.sim);

  try {
    // Attribute to the SIM's device if we can match it, else the first device.
    const devices = await pb.collection("devices").getFullList<DeviceRecord>({
      filter: `api_key = "${apiKey.id}"`,
    });
    const match =
      (sim !== undefined &&
        devices.find(
          (d) => d.subscription_id === sim || d.sim_slot === sim
        )) ||
      devices[0];

    if (!match) {
      return Response.json({ error: "no_device" }, { status: 400 });
    }

    const created = await pb.collection("messages").create({
      device: match.id,
      direction: "in",
      from: body.from || "",
      body: body.body,
      sim,
      status: "received",
    });

    return Response.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("/incoming error", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
