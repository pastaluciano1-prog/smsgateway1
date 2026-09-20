import "server-only";
import PocketBase from "pocketbase";
import { PB_URL } from "./pb";

// The server can reach PocketBase over a private network (e.g. a Docker/compose
// service name) while the browser uses the public NEXT_PUBLIC_PB_URL. Prefer the
// internal URL when set; otherwise fall back to the public one.
const SERVER_PB_URL = process.env.POCKETBASE_INTERNAL_URL || PB_URL;

// Server-only PocketBase client authenticated as the superuser.
// Used by the phone-facing API routes (/api/outgoing, /status, /incoming)
// which authenticate the phone via a bearer API key, NOT a user session.
//
// A fresh client is returned per call so request handlers never share auth
// state. The superuser token is cached in-module and reused until it expires.
let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // re-auth every 10 min to be safe

export async function getAdminClient(): Promise<PocketBase> {
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD are not set"
    );
  }

  const pb = new PocketBase(SERVER_PB_URL);
  pb.autoCancellation(false);

  const fresh = cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS;
  if (fresh) {
    pb.authStore.save(cachedToken as string, null);
    return pb;
  }

  await pb.collection("_superusers").authWithPassword(email, password);
  cachedToken = pb.authStore.token;
  cachedAt = Date.now();
  return pb;
}
