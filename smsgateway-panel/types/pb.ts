import type { RecordModel } from "pocketbase";

export interface UserRecord extends RecordModel {
  email: string;
  name?: string;
  verified: boolean;
}

export interface ApiKeyRecord extends RecordModel {
  name: string;
  key: string;
  user: string;
}

export interface DeviceRecord extends RecordModel {
  api_key: string;
  name?: string;
  sim_slot?: number;
  subscription_id?: number;
  carrier?: string;
  number?: string;
  rate_limit_per_min?: number;
  last_seen?: string;
}

export type MessageDirection = "out" | "in";
export type MessageStatus =
  | "pending"
  | "sent"
  | "failed"
  | "received"
  | "scheduled"
  | "sending";

export interface MessageRecord extends RecordModel {
  device?: string;
  direction: MessageDirection;
  to?: string;
  from?: string;
  body: string;
  sim?: number;
  status: MessageStatus;
  error?: string;
  send_at?: string;
}
