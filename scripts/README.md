# SMS sender scripts (terminal, no dependencies)

Two ways to use these, depending on whether you run the panel:

| You have… | Use | What it is |
| --------- | --- | ---------- |
| **No panel** (just the app + Python) | **`standalone_server.py`** | This script *is* the backend. The phone polls it directly. |
| The panel running as your backend | `send.py` | A client that queues messages into the panel. |

---

## Option A — No panel: `standalone_server.py`

The phone can only **pull** messages (it never receives pushes), so something has
to answer its requests. This script does that itself — using Python's built-in
web server, so it's still one file with **zero dependencies** and **no panel,
PocketBase, or Flask**.

1. Copy `standalone.config.example.json` → `standalone.config.json`:
   ```json
   {
     "port": 8000,
     "message": "Hello!",
     "rate_per_phone_per_minute": 20,
     "phones": [
       { "name": "Phone 1", "api_key": "phone1key" },
       { "name": "Phone 2", "api_key": "phone2key" }
     ]
   }
   ```
   The `api_key` values are ones **you make up** — each phone connects with its own.

2. Put recipients in `numbers.txt` (one per line; missing `+` is added).

3. Run it:
   ```bash
   python standalone_server.py
   ```

4. In the app, tap **Connect → enter manually**:
   - **Host:** `http://<this-computer>:8000` — reachable from the phone via your
     LAN IP, a `adb reverse tcp:8000 tcp:8000` USB tunnel, or an ngrok URL.
   - **API key:** one of the keys from your config (Phone 1 uses `phone1key`, etc.)

The script splits the numbers across your phones, hands them out at
`rate_per_phone_per_minute` each, records everything to `results.csv`, and prints
sent/failed/incoming live. Stop with Ctrl+C.

> 5 phones × 20/min = ~100 messages/minute, all sending in parallel.

---

## Option B — With the panel: `send.py`

Send SMS from the command line — panel is the backend.
You keep two files next to `send.py`:

- **`config.json`** — your phones, message, and rate
- **`numbers.txt`** — the recipients, one per line

## Setup

1. Run the panel/backend somewhere the script can reach (`host` below).
2. For **each phone** you've connected, copy its **API key** from the panel's
   *API Keys & Devices* page. One phone = one API key.
3. Copy `config.example.json` → `config.json` and fill it in:

```json
{
  "host": "http://localhost:3000",
  "message": "Hello! This is a test message.",
  "rate_per_phone_per_minute": 20,
  "randomize": true,
  "phones": [
    { "name": "Phone 1", "api_key": "key_for_phone_1" },
    { "name": "Phone 2", "api_key": "key_for_phone_2" },
    { "name": "Phone 3", "api_key": "key_for_phone_3" }
  ]
}
```

| Field | Meaning |
| ----- | ------- |
| `host` | Where the backend is reachable (e.g. `https://panel.example.com`). |
| `message` | The text sent to every number. |
| `rate_per_phone_per_minute` | Max messages **per phone** per minute. With 3 phones at 20 → ~60/min total. |
| `randomize` | Shuffle recipients + jitter timing so it's not robotic. |
| `phones[]` | One entry per phone. `api_key` is required. Add `"sim": <id>` only if a phone has multiple SIMs and you want a specific one. |

4. Put your recipients in `numbers.txt`, one per line:

```
+15551234567
5559876543
447700900123
```

Numbers **without** a `+` get one added automatically; numbers that already
have `+` are left alone. Spaces, dashes and parentheses are stripped. (Include
the country code — a bare local number just gets a `+` in front.)

## Run

```bash
python send.py            # reads config.json + numbers.txt from this folder
python send.py --dry-run  # show the plan and distribution, send nothing
```

The script splits the numbers evenly across your phones and paces each phone at
`rate_per_phone_per_minute`, so all phones send in parallel. Messages are queued
on the server; each phone sends its share on its next poll. Watch progress in
the terminal, and see sent/failed in the panel's **Messages** page.

### How the rate works

- 5 phones × 20/min = up to 100 messages/minute.
- The script paces the **queuing**. If you also set a per-SIM rate limit in the
  panel, that acts as a hard cap on the phone side — you can leave it blank and
  let the script control the rate.

## Options / files

- `--config path` / `--numbers path` — use files elsewhere.
- `config.json` and `numbers.txt` are gitignored (they hold your keys and
  recipient lists); the `*.example.*` files are the templates.

---

`send_bulk.py` is an alternative that takes everything as command-line flags
(`--host --key --file --message`) instead of a config file — handy for one-off
sends or cron. See its `--help`.
