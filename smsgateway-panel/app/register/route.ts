import { authenticate, unauthorized } from "@/lib/api-auth";
import type { DeviceRecord } from "@/types/pb";

export const dynamic = "force-dynamic";

interface IncomingSim {
  device_id?: string;
  sim_slot?: number;
  subscription_id?: number;
  carrier?: string;
  number?: string;
  name?: string;
  model?: string;
  manufacturer?: string;
  android?: string;
}

// POST /register  { devices: [{ device_id, sim_slot, subscription_id, carrier, number }] }
// The phone reports its SIMs on connect. Devices are upserted (matched on
// device_id + subscription_id, falling back to sim_slot) so re-registering
// is idempotent. device_id identifies the physical phone install — without
// it, multiple phones sharing one API key/QR code would all match the same
// row (by subscription_id/sim_slot alone) and overwrite each other. Older
// app builds that don't send device_id fall back to the old matching so
// they keep working, but can still collide with each other as before.
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
      const sameSim = (d: DeviceRecord) =>
        (sim.subscription_id !== undefined &&
          d.subscription_id === sim.subscription_id) ||
        (sim.sim_slot !== undefined && d.sim_slot === sim.sim_slot);

      // When the phone sends a device_id, only match rows from that same
      // physical install. Otherwise (older app builds) fall back to the
      // previous, install-agnostic matching.
      const found = sim.device_id
        ? existing.find((d) => d.device_id === sim.device_id && sameSim(d))
        : existing.find(sameSim);

      const data: Partial<DeviceRecord> = {
        api_key: apiKey.id,
        device_id: sim.device_id,
        sim_slot: sim.sim_slot,
        subscription_id: sim.subscription_id,
        carrier: sim.carrier,
        model: sim.model,
        manufacturer: sim.manufacturer,
        android: sim.android,
        last_seen: now,
      };

      // Name and number can be hand-edited in the panel (e.g. the carrier
      // doesn't report the phone's own number). Auto-registration only fills
      // them in the first time — once a row has a value, later syncs from
      // the phone don't overwrite it.
      if (!found) {
        data.name = sim.name || sim.carrier || `SIM ${sim.sim_slot ?? ""}`.trim();
        data.number = sim.number;
      } else {
        if (!found.name && sim.name) data.name = sim.name;
        if (!found.number && sim.number) data.number = sim.number;
      }

      const rec = found
        ? await pb.collection("devices").update<DeviceRecord>(found.id, data)
        : await pb.collection("devices").create<DeviceRecord>(data);
      out.push({ id: rec.id, sim_slot: rec.sim_slot });
    }

    return Response.json({ ok: true, devices: out });
  } catch (err) {
    console.error("/register error", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
