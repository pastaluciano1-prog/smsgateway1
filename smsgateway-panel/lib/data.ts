"use client";

import { createClient } from "@/lib/pb";
import type {
  ApiKeyRecord,
  DeviceRecord,
  MessageRecord,
  MessageStatus,
} from "@/types/pb";

const pb = createClient();

// A reasonably long, URL-safe random token for a phone's API key.
export function generateKey(): string {
  const bytes = new Uint8Array(30);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
}

// ---- API keys -------------------------------------------------------------

export function listApiKeys(userId: string) {
  return pb.collection("api_keys").getFullList<ApiKeyRecord>({
    filter: `user = "${userId}"`,
    sort: "-created",
  });
}

export function createApiKey(userId: string, name: string) {
  return pb.collection("api_keys").create<ApiKeyRecord>({
    user: userId,
    name,
    key: generateKey(),
  });
}

export function deleteApiKey(id: string) {
  return pb.collection("api_keys").delete(id);
}

// ---- Devices --------------------------------------------------------------

export function listDevices(apiKeyId: string) {
  return pb.collection("devices").getFullList<DeviceRecord>({
    filter: `api_key = "${apiKeyId}"`,
    sort: "sim_slot",
  });
}

// All devices belonging to the current user (across every key).
export function listUserDevices(userId: string) {
  return pb.collection("devices").getFullList<DeviceRecord>({
    filter: `api_key.user = "${userId}"`,
    sort: "-created",
    expand: "api_key",
  });
}

export function createDevice(data: Partial<DeviceRecord>) {
  return pb.collection("devices").create<DeviceRecord>(data);
}

export function updateDevice(id: string, data: Partial<DeviceRecord>) {
  return pb.collection("devices").update<DeviceRecord>(id, data);
}

export function deleteDevice(id: string) {
  return pb.collection("devices").delete(id);
}

// ---- Messages -------------------------------------------------------------

export interface MessageFilters {
  direction?: "out" | "in";
  status?: MessageStatus;
  search?: string;
}

export function listMessages(
  userId: string,
  filters: MessageFilters = {},
  page = 1,
  perPage = 50
) {
  const parts = [`device.api_key.user = "${userId}"`];
  if (filters.direction) parts.push(`direction = "${filters.direction}"`);
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.search) {
    const s = filters.search.replace(/"/g, '');
    parts.push(`(to ~ "${s}" || from ~ "${s}" || body ~ "${s}")`);
  }
  return pb.collection("messages").getList<MessageRecord>(page, perPage, {
    filter: parts.join(" && "),
    sort: "-created",
    expand: "device",
  });
}

export interface NewMessage {
  device: string;
  to: string;
  body: string;
  sim?: number;
  sendAt?: string; // ISO string; when set the message is scheduled
}

export function createMessage(m: NewMessage) {
  const scheduled = Boolean(m.sendAt);
  return pb.collection("messages").create<MessageRecord>({
    device: m.device,
    direction: "out",
    to: m.to,
    body: m.body,
    sim: m.sim,
    status: scheduled ? "scheduled" : "pending",
    send_at: m.sendAt || "",
  });
}

// Re-queue an existing message as a fresh pending send (same device/to/body/sim).
export function resendMessage(m: MessageRecord) {
  return pb.collection("messages").create<MessageRecord>({
    device: m.device,
    direction: "out",
    to: m.to,
    body: m.body,
    sim: m.sim,
    status: "pending",
    send_at: "",
  });
}

// Create many outgoing messages efficiently (bulk send).
export async function createMessages(list: NewMessage[]) {
  const results = await Promise.allSettled(list.map((m) => createMessage(m)));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  return { ok, failed: results.length - ok };
}

// ---- Stats ----------------------------------------------------------------

export async function countMessages(
  userId: string,
  status?: MessageStatus,
  direction?: "out" | "in"
) {
  const parts = [`device.api_key.user = "${userId}"`];
  if (status) parts.push(`status = "${status}"`);
  if (direction) parts.push(`direction = "${direction}"`);
  const res = await pb.collection("messages").getList<MessageRecord>(1, 1, {
    filter: parts.join(" && "),
    fields: "id",
  });
  return res.totalItems;
}
