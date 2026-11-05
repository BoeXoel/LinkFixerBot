# AGENTS.md — Link Fixer (EdgeOne)

Orientation for AI coding assistants working in this repository.

## What this is

A Telegram **link-fixer** bot on EdgeOne Edge Functions: rewrite share links to cleaner public URLs. Optional allowlist (`PRIVILEGED_ONLY`).

## Layout

| Path | Role |
|------|------|
| `edge-functions/api/telegram.js` | Webhook entry |
| `edge-functions/lib/links.js` | Sync rewrites + async short-link resolution |
| `edge-functions/lib/bilibili.js` | b23 expand + bilibili tracker strip |
| `edge-functions/lib/cleaners.js` | Xiaohongshu, WeChat, Tieba, Weibo, Pinduoduo, Taobao/Tmall, JD cleaners & short-link expand |
| `edge-functions/lib/privilege.js` | Allowlist (env + optional KV) |
| `edge-functions/lib/config.js` | Env → config (`PRIVILEGED_ONLY`, …) |
| `public/` | Static landing only |

## Rules

- Import helpers with **relative paths** under `edge-functions/`.
- Edge runtime: Web APIs (`fetch`, `Request`, `Response`). No Node built-ins unless moved to cloud-functions.
- Secrets only via env: `BOT_TOKEN`, `WEBHOOK_SECRET`, etc. Never hardcode tokens.
- KV (`PRIV_KV`) is **optional**; required only for `/grant` / `/revoke` dynamic lists.
- Public `/help` must not advertise private-mode admin commands.

## Behaviour

1. If `PRIVILEGED_ONLY` and user not allowlisted → no reply.
2. Convert X / Bluesky / Zhihu / Bilibili (b23) links; reply with plain URLs.
3. Silent when nothing to convert.
