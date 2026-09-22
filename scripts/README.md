# Automation scripts

Send SMS through your gateway from the command line / cron, using the panel's
`POST /send` API. No third-party packages — just Python 3.

## Setup

1. In the panel → **API Keys & Devices**, create a key and copy it.
2. Make sure a phone is connected to that key and has at least one device/SIM.
3. Note your panel URL (the public one, e.g. `https://panel.example.com`).

## Send the same message to a list

`numbers.txt` — one number per line (see `numbers.example.txt`):

```bash
python send_bulk.py \
  --host https://panel.example.com \
  --key  YOUR_API_KEY \
  --file numbers.txt \
  --message "Hello from the SMS gateway!"
```

## Send a personalized message per number

`messages.csv` — each line is `number,message` (see `messages.example.csv`):

```bash
python send_bulk.py --host ... --key ... --file messages.csv --csv
```

## Options

| Flag         | Meaning                                                        |
| ------------ | ------------------------------------------------------------- |
| `--sim N`    | Send from a specific SIM (subscription id or slot as shown in the panel). Omit to use the first device. |
| `--chunk N`  | Recipients per request in bulk mode (default 100).            |
| `--delay S`  | Seconds to wait between requests (throttle to respect a SIM's rate limit). |
| `--dry-run`  | Parse and print what would be sent, without sending.          |

Messages are **queued on the server**; the connected phone sends them on its
next poll. Check status (sent/failed) in the panel's **Messages** page.

## Notes

- The API key is a bearer credential — keep it secret. Prefer passing it via an
  environment variable in scripts/cron rather than hardcoding:
  ```bash
  python send_bulk.py --host "$PANEL_URL" --key "$SMS_API_KEY" --file numbers.txt --message "..."
  ```
- Per-SIM rate limits set in the panel are enforced when the phone pulls
  messages, so it's safe to queue a large batch at once — they'll go out at the
  allowed rate.
