import { authenticate, unauthorized } from "@/lib/api-auth";
import type { MessageRecord } from "@/types/pb";

export const dynamic = "force-dynamic";

// POST /status  { id, status: "sent"|"failed", error? }
// The phone reports the outcome of a message it picked up from /outgoing.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return unauthorized();
  const { pb, apiKey } = auth;

  let body: { id?: string; status?: string; error?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { id, status, error } = body;
  if (!id || (status !== "sent" && status !== "failed")) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    // Ownership check: the message must belong to a device under this key.
    const msg = await pb
      .collection("messages")
      .getOne<MessageRecord>(id, { expand: "device" });
    const owner = (msg.expand?.device as { api_key?: string } | undefined)
      ?.api_key;
    if (owner !== apiKey.id) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    await pb.collection("messages").update(id, {
      status,
      error: status === "failed" ? error || "unknown error" : "",
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}
