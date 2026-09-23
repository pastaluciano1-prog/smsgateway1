import { authenticate, unauthorized } from "@/lib/api-auth";
import type { DeviceRecord } from "@/types/pb";

export const dynamic = "force-dynamic";

interface IncomingSim {
  sim_slot?: number;
  subscription_id?: number;
  carrier?: string;
  number?: string;
  name?: string;
  model?: string;
  manufacturer?: string;
  android?: string;
}

// POST /register  { devices: [{ sim_slot, subscription_id, carrier, number }] }
// The phone reports its SIMs on connect. Devices are upserted (matched on
// subscription_id, falling back to sim_slot) so re-registering is idempotent.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { pb, apiKey } = auth;

  let payload: { devices?: IncomingSim[] } | IncomingSim[];
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const sims: IncomingSim[] = Array.isArray(payload)
    ? payload
    : payload.devices ?? [];
  if (sims.length === 0) {
    return Response.json({ error: "no_sims" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString().replace("T", " ");
    const existing = await pb.collection("devices").getFullList<DeviceRecord>({
      filter: `api_key = "${apiKey.id}"`,
    });

    const out: { id: string; sim_slot?: number }[] = [];

    for (const sim of sims) {
      const found = existing.find(
        (d) =>
          (sim.subscription_id !== undefined &&
            d.subscription_id === sim.subscription_id) ||
          (sim.sim_slot !== undefined && d.sim_slot === sim.sim_slot)
      );

      const data: Partial<DeviceRecord> = {
        api_key: apiKey.id,
        sim_slot: sim.sim_slot,
        subscription_id: sim.subscription_id,
        carrier: sim.carrier,
        number: sim.number,
        model: sim.model,
        manufacturer: sim.manufacturer,
        android: sim.android,
        last_seen: now,
      };
      // Don't clobber a user-set name with an empty one.
      if (sim.name) data.name = sim.name;

      const rec = found
        ? await pb.collection("devices").update<DeviceRecord>(found.id, data)
        : await pb
            .collection("devices")
            .create<DeviceRecord>({
              ...data,
              name: sim.name || sim.carrier || `SIM ${sim.sim_slot ?? ""}`.trim(),
            });
      out.push({ id: rec.id, sim_slot: rec.sim_slot });
    }

    return Response.json({ ok: true, devices: out });
  } catch (err) {
    console.error("/register error", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
