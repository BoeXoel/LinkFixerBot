# Link Fixer

Telegram bot that rewrites social share links into cleaner public URLs.  
Deployed on [EdgeOne Makers](https://pages.edgeone.ai/) **Edge Functions** (similar in spirit to Cloudflare Workers).

**Self-host this project.** The open-source tree is a template — run your own bot instance rather than treating someone else’s production bot as a free public service.

## Features

| Source | Result |
|--------|--------|
| `x.com` | `fixupx.com` |
| `twitter.com` | `fxtwitter.com` |
| `bsky.app` | `fxbsky.app` |
| `zhihu.com` / `zhuanlan.zhihu.com` | `fxzhihu.com` / `zhuanlan.fxzhihu.com` |
| `b23.tv` (and similar short hosts) | clean `bilibili.com` (tracking stripped) |
| Long `bilibili.com` links with trackers | same cleaning (`p=1` dropped; `p≥2` and `t` kept) |

- Replies with **plain URLs** only (easy to copy; no platform banners).
- Silent when the message has no supported links.
- Optional privileged X-media extraction exists in the tree but is **disabled** (see comments in `edge-functions/lib/handle-message.js`).

## Layout

```
.
├─ edge-functions/
│  ├─ api/
│  │  ├─ telegram.js    # POST /api/telegram (webhook)
│  │  └─ health.js      # GET /api/health
│  └─ lib/              # link rewrite, bilibili resolve, …
├─ public/index.html    # optional landing page
├─ edgeone.json
├─ .env.example
├─ LICENSE              # MIT
└─ package.json
```

Only `edge-functions/**/*.js` and static assets are needed at runtime. Secrets never belong in git.

## Build settings (EdgeOne)

| Field | Value |
|-------|--------|
| Root directory | `./` |
| Build / install command | leave empty |
| **Output directory** | **`public`** (not `pubic`) |

`edgeone.json` sets `"outputDirectory": "public"`.

## Setup

### 1. Create a bot

[@BotFather](https://t.me/BotFather) → `/newbot` → copy the **HTTP API token**.

### 2. Deploy on EdgeOne

1. Import this GitHub repo into [EdgeOne Makers](https://console.tencentcloud.com/edgeone/makers).
2. Set environment variables (Project settings → **not** committed files):

| Name | Required | Description |
|------|----------|-------------|
| `BOT_TOKEN` | yes | BotFather API token |
| `WEBHOOK_SECRET` | recommended | Random string; must match `setWebhook` `secret_token` |
| `BOOTSTRAP_PRIVILEGED_IDS` | no | Only if you re-enable privilege features |
| `MEDIA_MODE` | no | Used only if media extraction is re-enabled |

3. Deploy and note the HTTPS origin (e.g. `https://your-app.edgeone.app`).

### 3. Set the Telegram webhook

```bash
export BOT_TOKEN='...'
export WEBHOOK_SECRET='...'   # same as EdgeOne env, if set
export BASE='https://YOUR_DOMAIN'

curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${BASE}/api/telegram" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'
```

```bash
curl -sS "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

### 4. Smoke test

- `GET https://YOUR_DOMAIN/api/health`
- Telegram: `/start`, then paste an `x.com` or `b23.tv` link

## Commands

| Command | Action |
|---------|--------|
| `/help` | Public usage |
| `/whoami` | Your Telegram numeric user id |

## Security notes

- Never commit `.env` or real tokens (see `.gitignore`).
- Prefer `WEBHOOK_SECRET` so random clients cannot POST fake updates.
- If a token leaks: BotFather → revoke → update EdgeOne env → `setWebhook` again.

## Acknowledgments

- [FxEmbed](https://github.com/FxEmbed/FxEmbed) — FixupX / FxTwitter / FxBluesky  
- [fxzhihu](https://github.com/frostming/fxzhihu) — Zhihu fix instances  
- [b23.tv-tools](https://github.com/SunsetMkt/b23.tv-tools), [b23.wtf](https://github.com/nicholascw/b23.wtf) — ideas for short-link expansion & tracking cleanup  
- [EdgeOne Makers](https://pages.edgeone.ai/) — hosting  
- Development assistance from **Grok** ([xAI](https://x.ai/))

## License

[MIT](./LICENSE) © 2026 [Boe Xoel](https://github.com/BoeXoel)
