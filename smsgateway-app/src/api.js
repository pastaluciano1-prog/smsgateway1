import { loadConfig } from './store';

// Build a clean base URL + auth headers from saved config
async function getBase() {
  const { host, apiKey } = await loadConfig();
  const base = host.replace(/\/+$/, ''); // strip trailing slashes
  return {
    base,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

// Ask the server: any messages waiting to be sent?
// Expected response: [{ id, to, body, sim }]
export async function fetchOutgoing() {
  const { base, headers } = await getBase();
  const res = await fetch(`${base}/outgoing`, { headers });
  if (!res.ok) throw new Error(`outgoing ${res.status}`);
  return res.json();
}

// Tell the server how a message went.
// status: "sent" | "failed"
export async function reportStatus(id, status, error) {
  const { base, headers } = await getBase();
  await fetch(`${base}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id, status, error: error || null }),
  });
}

// Register / update this phone's SIMs on the server so the panel knows about
// them (carrier, slot, subscription id). Idempotent — safe to call on every
// connect/refresh. `sims` is the array returned by SmsGateway.getSimInfo().
export async function registerDevices(sims) {
  if (!sims || sims.length === 0) return;
  const { base, headers } = await getBase();
  const devices = sims.map((s) => ({
    sim_slot: s.slot,
    subscription_id: s.subscriptionId,
    carrier: s.carrier || '',
    number: s.number || '',
  }));
  const res = await fetch(`${base}/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ devices }),
  });
  if (!res.ok) throw new Error(`register ${res.status}`);
  return res.json();
}

// Forward an incoming SMS to the server.
export async function postIncoming(msg) {
  const { base, headers } = await getBase();
  await fetch(`${base}/incoming`, {
    method: 'POST',
    headers,
    body: JSON.stringify(msg),
  });
}