#!/usr/bin/env python3
"""
Send SMS through your self-hosted SMS Gateway from a text file.

Talks to the panel's POST /send endpoint using your API key (the same key the
phone uses). Messages are queued on the server; your connected phone sends them.

No third-party packages required (standard library only).

Examples
--------
Same message to every number in numbers.txt:

    python send_bulk.py \
        --host https://panel.example.com \
        --key  YOUR_API_KEY \
        --file numbers.txt \
        --message "Hello from the SMS gateway!"

Per-number message (CSV: each line is `number,message`):

    python send_bulk.py --host ... --key ... --file messages.csv --csv

Pick a SIM (subscription id or slot, as shown in the panel) and throttle:

    python send_bulk.py ... --sim 1 --delay 1.0
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def post_send(host, key, recipients, body, sim=None, timeout=30):
    """Call POST /send. Returns the parsed JSON response."""
    url = host.rstrip("/") + "/send"
    payload = {"to": recipients, "body": body}
    if sim is not None:
        payload["sim"] = sim
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def read_lines(path):
    """Yield non-empty, non-comment lines."""
    with open(path, "r", encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if line and not line.startswith("#"):
                yield line


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def main():
    ap = argparse.ArgumentParser(description="Send bulk SMS via the SMS Gateway API.")
    ap.add_argument("--host", required=True, help="Panel URL, e.g. https://panel.example.com")
    ap.add_argument("--key", required=True, help="API key (from the panel's API Keys page)")
    ap.add_argument("--file", required=True, help="Text file: one number per line, or number,message with --csv")
    ap.add_argument("--message", help="Message body sent to every number (omit when using --csv)")
    ap.add_argument("--csv", action="store_true", help="Treat each line as `number,message`")
    ap.add_argument("--sim", type=int, default=None, help="SIM subscription id / slot to send from")
    ap.add_argument("--chunk", type=int, default=100, help="Recipients per request in bulk mode (default 100)")
    ap.add_argument("--delay", type=float, default=0.0, help="Seconds to wait between requests")
    ap.add_argument("--dry-run", action="store_true", help="Parse and print what would be sent, but don't send")
    args = ap.parse_args()

    lines = list(read_lines(args.file))
    if not lines:
        sys.exit("No numbers found in " + args.file)

    total_queued = 0
    total_failed = 0

    if args.csv:
        # Personalized: each line is `number,message`.
        pairs = []
        for line in lines:
            if "," not in line:
                print("Skipping (no comma): " + line, file=sys.stderr)
                continue
            number, message = line.split(",", 1)
            pairs.append((number.strip(), message.strip()))
        print("%d personalized message(s) to send." % len(pairs))
        for number, message in pairs:
            if args.dry_run:
                print("  -> %s : %s" % (number, message))
                continue
            try:
                res = post_send(args.host, args.key, [number], message, args.sim)
                total_queued += res.get("queued", 0)
                total_failed += res.get("failed", 0)
                print("  queued %s" % number)
            except urllib.error.HTTPError as e:
                total_failed += 1
                print("  HTTP %s for %s: %s" % (e.code, number, e.read().decode("utf-8", "ignore")), file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                total_failed += 1
                print("  error for %s: %s" % (number, e), file=sys.stderr)
            if args.delay:
                time.sleep(args.delay)
    else:
        # Bulk: same message to every number.
        if not args.message:
            sys.exit("--message is required (or use --csv for per-line messages)")
        numbers = [ln.split(",")[0].strip() for ln in lines]
        print("%d recipient(s), %d per request." % (len(numbers), args.chunk))
        for batch in chunked(numbers, args.chunk):
            if args.dry_run:
                print("  -> batch of %d: %s ..." % (len(batch), ", ".join(batch[:3])))
                continue
            try:
                res = post_send(args.host, args.key, batch, args.message, args.sim)
                total_queued += res.get("queued", 0)
                total_failed += res.get("failed", 0)
                print("  queued %d (device %s, sim %s)" % (res.get("queued", 0), res.get("device"), res.get("sim")))
            except urllib.error.HTTPError as e:
                total_failed += len(batch)
                print("  HTTP %s: %s" % (e.code, e.read().decode("utf-8", "ignore")), file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                total_failed += len(batch)
                print("  error: %s" % e, file=sys.stderr)
            if args.delay:
                time.sleep(args.delay)

    print("\nDone. Queued: %d  Failed: %d" % (total_queued, total_failed))
    if total_failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
