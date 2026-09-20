import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "http://127.0.0.1:8090";

// Browser-side singleton, mirroring the `createClient()` pattern.
// PocketBase's default LocalAuthStore persists the token in localStorage,
// so the session survives reloads and `authStore.onChange` drives the context.
let browserClient: PocketBase | null = null;

export function createClient(): PocketBase {
  if (typeof window === "undefined") {
    // On the server we never want to share a client (auth state would leak
    // across requests). Callers that need server access use lib/pb-admin.ts.
    return new PocketBase(PB_URL);
  }
  if (!browserClient) {
    browserClient = new PocketBase(PB_URL);
    browserClient.autoCancellation(false);
  }
  return browserClient;
}

export { PB_URL };
