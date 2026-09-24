import { loadConfig, getOrCreateDeviceId } from './store';

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

// fetch with a hard timeout. A hung request would otherwise wedge the poll
// loop's `running` guard forever, making the app look disconnected.
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Ask the server: any messages waiting to be sent?
// Expected response: [{ id, to, body, sim }]
export async function fetchOutgoing() {
  const { base, headers } = await getBase();
  const res = await fetchWithTimeout(`${base}/outgoing`, { headers });
  if (!res.ok) throw new Error(`outgoing ${res.status}`);
  return res.json();
}

// Tell the server how a message went.
// status: "sent" | "failed"
export async function reportStatus(id, status, error) {
  const { base, headers } = await getBase();
  await fetchWithTimeout(`${base}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id, status, error: error || null }),
  });
}

// Register / update this phone's SIMs on the server so the panel knows about
// them (carrier, slot, model, Android version). Idempotent — safe to call on
// every connect/refresh. `sims` is SmsGateway.getSimInfo(); `info` is
// SmsGateway.getDeviceInfo().
export async function registerDevices(sims, info) {
  const { base, headers } = await getBase();
  const deviceId = await getOrCreateDeviceId();

  // If SIM info isn't available yet (phone permission not granted), still
  // register the phone itself at slot 0 so it shows up in the panel. When SIM
  // permission is later granted, the real SIM at slot 0 updates this same row.
  if (!sims || sims.length === 0) {
    sims = [{ slot: 0, subscriptionId: 0, carrier: '', number: '' }];
  }

  const model = info?.model || '';
  const manufacturer = info?.manufacturer || '';
  const android = info
    ? `Android ${info.androidRelease} (API ${info.sdkInt})`
    : '';
  // A friendly default name for the device row: the user's device name, else
  // "Samsung SM-S938B". Carrier is appended when there are multiple SIMs.
  const friendly =
    info?.name ||
    [manufacturer, model].filter(Boolean).join(' ') ||
    'Phone';

  const devices = sims.map((s) => ({
    device_id: deviceId,
    sim_slot: s.slot,
    subscription_id: s.subscriptionId,
    carrier: s.carrier || '',
    number: s.number || '',
    model,
    manufacturer,
    android,
    name:
      sims.length > 1 && s.carrier ? `${friendly} · ${s.carrier}` : friendly,
  }));

  const res = await fetchWithTimeout(`${base}/register`, {
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
  await fetchWithTimeout(`${base}/incoming`, {
    method: 'POST',
    headers,
    body: JSON.stringify(msg),
  });
}