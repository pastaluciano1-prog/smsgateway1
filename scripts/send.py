#!/usr/bin/env python3
"""
Bulk SMS sender — terminal only, no server, no dependencies.

Reads config.json + numbers.txt (in this folder), then sends your message to
every number, spread across your phones at a fixed rate per phone per minute.

    python send.py                 # uses config.json + numbers.txt here
    python send.py --dry-run       # show the plan, send nothing

Rate example: 3 phones at 20/min each  ->  ~60 messages/minute total.
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- helpers ----
def normalize(number: str) -> str:
    """Strip spaces/dashes/parens; add a leading + if it's missing."""
    n = number.strip()
    for ch in (" ", "-", "(", ")", "."):
        n = n.replace(ch, "")
    if not n:
        return ""
    if not n.startswith("+"):
        n = "+" + n
    return n


def load_numbers(path: str):
    out = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            num = normalize(line.split(",")[0])
            if num:
                out.append(num)
    return out


def post_send(host, api_key, to, body, sim=None, timeout=30):
    url = host.rstrip("/") + "/send"
    payload = {"to": [to], "body": body}
    if sim is not None:
        payload["sim"] = sim
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + api_key},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ------------------------------------------------------------------- main ----
def main():
    ap = argparse.ArgumentParser(description="Bulk SMS sender (config.json + numbers.txt).")
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--numbers", default=os.path.join(HERE, "numbers.txt"))
    ap.add_argument("--dry-run", action="store_true", help="Plan only, send nothing.")
    args = ap.parse_args()

    with open(args.config, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    host = cfg["host"]
    phones = cfg["phones"]
    message = cfg["message"]
    rate = float(cfg.get("rate_per_phone_per_minute", 20))
    do_random = bool(cfg.get("randomize", True))

    if not phones:
        sys.exit("config.json: 'phones' is empty.")
    if rate <= 0:
        sys.exit("config.json: 'rate_per_phone_per_minute' must be > 0.")

    numbers = load_numbers(args.numbers)
    if not numbers:
        sys.exit("No numbers found in " + args.numbers)
    if do_random:
        random.shuffle(numbers)

    # Split recipients evenly across phones (round-robin).
    buckets = [[] for _ in phones]
    for i, num in enumerate(numbers):
        buckets[i % len(phones)].append(num)

    interval = 60.0 / rate  # seconds between each phone's messages
    total = len(numbers)
    per_min = rate * len(phones)

    print("Sending %d message(s) across %d phone(s)." % (total, len(phones)))
    for p, b in zip(phones, buckets):
        print("  - %s: %d message(s)" % (p.get("name", p.get("api_key", "?")[:8]), len(b)))
    print("Rate: %g per phone/min  ->  ~%g per minute total." % (rate, per_min))
    print("Estimated time: ~%.1f min\n" % (max(len(b) for b in buckets) / rate))

    if args.dry_run:
        for p, b in zip(phones, buckets):
            for num in b[:5]:
                print("  [dry] %s -> %s" % (p.get("name", "?"), num))
        print("\nDry run - nothing sent.")
        return

    sent = failed = 0
    # Round-robin over phones: one message per phone per tick, then wait
    # `interval` so each phone stays at `rate` per minute.
    while any(buckets):
        order = list(range(len(phones)))
        if do_random:
            random.shuffle(order)
        for i in order:
            if not buckets[i]:
                continue
            phone = phones[i]
            num = buckets[i].pop(0)
            try:
                post_send(host, phone["api_key"], num, message, phone.get("sim"))
                sent += 1
                print("  sent  %-18s via %s" % (num, phone.get("name", "?")))
            except urllib.error.HTTPError as e:
                failed += 1
                print("  FAIL  %-18s (HTTP %s: %s)" % (num, e.code, e.read().decode("utf-8", "ignore")[:120]), file=sys.stderr)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print("  FAIL  %-18s (%s)" % (num, e), file=sys.stderr)

        if any(buckets):
            # Jitter a little so it doesn't look robotic, but keep the average
            # at `interval` so the per-minute rate holds.
            time.sleep(interval * (random.uniform(0.7, 1.3) if do_random else 1.0))

    print("\nDone. Queued: %d  Failed: %d" % (sent, failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
