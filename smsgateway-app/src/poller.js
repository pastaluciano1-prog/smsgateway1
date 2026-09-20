import { fetchOutgoing, reportStatus } from './api';
import { bumpCounter } from './store';
import SmsGateway from '../modules/sms-gateway/src/SmsGatewayModule';

let timer = null;
let running = false; // guard so overlapping ticks don't stack

// Process one message: send it, report result, update counters.
async function handleMessage(msg) {
  try {
    // msg.sim is a subscriptionId; use -1 (default SIM) if not provided
    const subId = typeof msg.sim === 'number' ? msg.sim : -1;
    SmsGateway.sendSms(msg.to, msg.body, subId);
    await bumpCounter('sent');
    await reportStatus(msg.id, 'sent');
  } catch (e) {
    await bumpCounter('failed');
    await reportStatus(msg.id, 'failed', String(e?.message || e));
  }
}

// One poll cycle: ask the server, send whatever came back.
async function tick(onChange) {
  if (running) return;      // previous tick still working, skip
  running = true;
  try {
    const messages = await fetchOutgoing();
    for (const msg of messages) {
      await handleMessage(msg);
    }
    if (messages.length && onChange) onChange();
  } catch (e) {
    // network/server error — just wait for the next tick
  } finally {
    running = false;
  }
}

// Start polling every `intervalMs` (default 5s).
export function startPolling(intervalMs = 5000, onChange) {
  if (timer) return;
  tick(onChange);                                   // run once immediately
  timer = setInterval(() => tick(onChange), intervalMs);
}

export function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
}