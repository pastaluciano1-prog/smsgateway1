import "server-only";
import { getAdminClient } from "@/lib/pb-admin";
import type { ApiKeyRecord } from "@/types/pb";
import type PocketBase from "pocketbase";

export interface AuthedRequest {
  pb: PocketBase;
  apiKey: ApiKeyRecord;
}

// Reads `Authorization: Bearer <key>`, resolves it to an api_keys record.
// Returns the record + an admin PocketBase client, or null if invalid.
export async function authenticate(
  req: Request
): Promise<AuthedRequest | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const key = match[1].trim();
  if (!key) return null;

  const pb = await getAdminClient();
  try {
    const apiKey = await pb
      .collection("api_keys")
      .getFirstListItem<ApiKeyRecord>(`key = "${key.replace(/"/g, "")}"`);
    return { pb, apiKey };
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
