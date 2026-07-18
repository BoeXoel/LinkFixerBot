# AGENTS.md — EdgeOne deployment

Telegram link-fixer bot on **EdgeOne Makers Edge Functions**.

For the Telegram Serverless archive, see [`../tgcloud`](../tgcloud).

## Rules

- Runtime is Edge (Web APIs): `fetch`, `Request`, `Response`, `FormData`, `Blob`.
- No Node built-ins unless you move code to `cloud-functions/`.
- Import helpers with **relative paths** under `edge-functions/` (e.g. `../lib/links.js`).
- Secrets live in env: `BOT_TOKEN`, `WEBHOOK_SECRET`, `BOOTSTRAP_PRIVILEGED_IDS`.
- Privilege storage: KV binding **`PRIV_KV`** (`user_<tgId>` keys).
- Bot API: `edge-functions/lib/telegram-api.js` — never hardcode tokens.
- Webhook entry: `edge-functions/api/telegram.js` only; keep business logic in `lib/`.

## Behaviour

1. Convert X / Bluesky / Zhihu share links to fix instances.
2. Expand `b23.tv` via HTTP redirect → clean `bilibili.com` (`lib/bilibili.js`).
3. Privileged X media extraction is **disabled** (commented in `handle-message.js`).
