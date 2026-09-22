# Bulk SMS sender (terminal)

Send SMS from the command line — no server, no dependencies, just Python 3.
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
