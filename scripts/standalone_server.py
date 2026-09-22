#!/usr/bin/env python3
"""
Standalone SMS Gateway server — no panel, no PocketBase, no Flask.

This ONE file is the whole backend. Your phone(s) poll it directly; it hands out
the numbers from numbers.txt at a controlled rate, and records the results.
Uses only the Python standard library.

Run:
    python standalone_server.py            # reads standalone.config.json + numbers.txt

Then in the app, connect with:
    Host:    http://<this-computer>:8000   (LAN IP, adb-reverse, or an ngrok URL)
    API key: one of the keys from your config

Config (standalone.config.json):
    {
      "port": 8000,
      "message": "Hello!",
      "rate_per_phone_per_minute": 20,
      "phones": [
        { "name": "Phone 1", "api_key": "phone1key" },
        { "name": "Phone 2", "api_key": "phone2key" }
      ]
    }
Each phone connects with its own api_key; numbers are split across the phones and
each phone is paced at rate_per_phone_per_minute.
"""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
SENDING_TIMEOUT = 180  # seconds before an un-confirmed message is re-queued
RESULTS_CSV = os.path.join(HERE, "results.csv")

lock = threading.Lock()
phones = {}   # api_key -> dict(name, queue, sending, handouts, sim, sent, failed)
counter = 0


def normalize(number: str) -> str:
    n = number.strip()
    for ch in (" ", "-", "(", ")", "."):
        n = n.replace(ch, "")
    if n and not n.startswith("+"):
        n = "+" + n
    return n


def load_numbers(path):
    out = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#"):
                num = normalize(line.split(",")[0])
                if num:
                    out.append(num)
    return out


def record(number, status, error=""):
    try:
        new = not os.path.exists(RESULTS_CSV)
        with open(RESULTS_CSV, "a", encoding="utf-8") as fh:
            if new:
                fh.write("time,number,status,error\n")
            fh.write("%s,%s,%s,%s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), number, status, error.replace(",", " ")))
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet default logging
        pass

    def _key(self):
        auth = self.headers.get("Authorization", "")
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    # ---- GET /outgoing ----
    def do_GET(self):
        if self.path.split("?")[0] != "/outgoing":
            return self._json(404, {"error": "not_found"})
        key = self._key()
        with lock:
            p = phones.get(key)
            if p is None:
                return self._json(401, {"error": "unauthorized"})
            now = time.time()

            # Re-queue stale "sending" messages (phone died mid-send).
            for mid, (msg, ts) in list(p["sending"].items()):
                if now - ts > SENDING_TIMEOUT:
                    p["queue"].insert(0, msg)
                    del p["sending"][mid]

            # Rate limit: at most `rate` hand-outs per rolling minute.
            p["handouts"] = [t for t in p["handouts"] if now - t < 60]
            allowance = max(0, p["rate"] - len(p["handouts"]))

            batch = []
            while allowance > 0 and p["queue"]:
                msg = p["queue"].pop(0)
                p["sending"][msg["id"]] = (msg, now)
                p["handouts"].append(now)
                allowance -= 1
                item = {"id": msg["id"], "to": msg["to"], "body": msg["body"]}
                if msg.get("sim") is not None:
                    item["sim"] = msg["sim"]
                batch.append(item)
        return self._json(200, batch)

    # ---- POST /status, /incoming, /register ----
    def do_POST(self):
        path = self.path.split("?")[0]
        key = self._key()
        data = self._read()
        with lock:
            p = phones.get(key)
            if p is None:
                return self._json(401, {"error": "unauthorized"})

            if path == "/status":
                mid = str(data.get("id", ""))
                status = data.get("status")
                entry = p["sending"].pop(mid, None)
                number = entry[0]["to"] if entry else "?"
                if status == "sent":
                    p["sent"] += 1
                    print("  SENT   %-18s via %s" % (number, p["name"]))
                    record(number, "sent")
                else:
                    p["failed"] += 1
                    err = str(data.get("error") or "")
                    print("  FAILED %-18s via %s (%s)" % (number, p["name"], err))
                    record(number, "failed", err)
                self._maybe_done()
                return self._json(200, {"ok": True})

            if path == "/incoming":
                print("  IN     %s -> %s: %s" % (data.get("from", "?"), p["name"], data.get("body", "")))
                record(data.get("from", "?"), "incoming", str(data.get("body", "")))
                return self._json(200, {"ok": True})

            if path == "/register":
                sims = data.get("devices", [])
                print("  %s registered %d SIM(s)" % (p["name"], len(sims)))
                return self._json(200, {"ok": True})

        return self._json(404, {"error": "not_found"})

    def _maybe_done(self):
        if all(not p["queue"] and not p["sending"] for p in phones.values()):
            total_sent = sum(p["sent"] for p in phones.values())
            total_failed = sum(p["failed"] for p in phones.values())
            print("\n=== All messages processed. Sent: %d  Failed: %d ===" % (total_sent, total_failed))
            print("(Server still running so phones can keep polling. Ctrl+C to stop.)\n")


def main():
    global counter
    import argparse
    ap = argparse.ArgumentParser(description="Standalone SMS Gateway server.")
    ap.add_argument("--config", default=os.path.join(HERE, "standalone.config.json"))
    ap.add_argument("--numbers", default=os.path.join(HERE, "numbers.txt"))
    args = ap.parse_args()

    with open(args.config, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    port = int(cfg.get("port", 8000))
    message = cfg["message"]
    rate = int(cfg.get("rate_per_phone_per_minute", 20))
    phone_list = cfg["phones"]
    if not phone_list:
        raise SystemExit("config: 'phones' is empty")

    numbers = load_numbers(args.numbers)
    if not numbers:
        raise SystemExit("No numbers in " + args.numbers)

    # Build per-phone state and split numbers round-robin.
    for ph in phone_list:
        phones[ph["api_key"]] = {
            "name": ph.get("name", ph["api_key"][:8]),
            "sim": ph.get("sim"),
            "rate": rate,
            "queue": [],
            "sending": {},
            "handouts": [],
            "sent": 0,
            "failed": 0,
        }
    keys = [ph["api_key"] for ph in phone_list]
    for i, number in enumerate(numbers):
        key = keys[i % len(keys)]
        counter += 1
        phones[key]["queue"].append({
            "id": str(counter), "to": number, "body": message, "sim": phones[key]["sim"],
        })

    print("SMS Gateway (standalone) on port %d" % port)
    for ph in phone_list:
        p = phones[ph["api_key"]]
        print("  %s  key=%s  queued=%d  rate=%d/min" % (p["name"], ph["api_key"], len(p["queue"]), rate))
    print("\nConnect the app to  http://<this-computer>:%d  with one of the keys above." % port)
    print("Waiting for phones to poll...\n")

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
        server.shutdown()


if __name__ == "__main__":
    main()
