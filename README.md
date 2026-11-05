# Link Fixer

A Telegram bot that rewrites social share links into cleaner public URLs.  
Designed to run on [EdgeOne Makers](https://pages.edgeone.ai/) **Edge Functions** (similar in spirit to Cloudflare Workers).

This repository is a **self-host template**. Deploy your own instance; do not treat other people’s production bots as a free public service.

## Deploy to EdgeOne

[![Deploy with EdgeOne Makers](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FBoeXoel%2FLinkFixerBot&project-name=link-fixer&output-directory=public&env=BOT_TOKEN%2CWEBHOOK_SECRET&env-description=BOT_TOKEN%20%28required%29%3A%20HTTP%20API%20token%20from%20%40BotFather.%20WEBHOOK_SECRET%20%28recommended%29%3A%20random%20string%20for%20setWebhook%20secret_token.%20Optional%3A%20PRIVILEGED_ONLY%2C%20BOOTSTRAP_PRIVILEGED_IDS%20%E2%80%94%20see%20README.&env-link=https%3A%2F%2Fgithub.com%2FBoeXoel%2FLinkFixerBot%23quick-start)

After the site deploys, you still need to call Telegram `setWebhook` once (see [Quick start](#quick-start)). EdgeOne cannot set the webhook for you.

Official docs: [Deploy button](https://pages.edgeone.ai/zh/document/deploy-button).

## Features

| Source | Result |
|--------|--------|
| `x.com` | `fixupx.com` (all query params stripped) |
| `twitter.com` | `fxtwitter.com` (all query params stripped) |
| `bsky.app` | `fxbsky.app` |
| `zhihu.com` / `zhuanlan.zhihu.com` | `www.fxzhihu.com` / `zhuanlan.fxzhihu.com` |
| `b23.tv` (and similar short hosts) | clean `bilibili.com` (tracking removed) |
| Long `bilibili.com` links with trackers | same cleaning (`p=1` dropped; `p≥2` and `t` kept) |
| `xhslink.com` / `xiaohongshu.com` | `www.xiaohongshu.com/explore/{id}` (keeps `xsec_token` & `xsec_source` only) |
| `mp.weixin.qq.com` | keeps `__biz`, `mid`, `idx`, `sn` (or `/s/{code}` path only) |
| `tieba.baidu.com` | `tieba.baidu.com/p/{id}` (query stripped) |
| `t.cn` / `weibo.com` / `m.weibo.cn` | clean Weibo status path (query stripped) |
| `mobile.yangkeduo.com` | `mobile.yangkeduo.com/goods.html?goods_id={id}` |
| `m.tb.cn` / `s.click.taobao.com` / `item.taobao.com` / `detail.tmall.com` | clean product URL with `?id={id}` only |
| `3.cn` / `u.jd.com` / `item.jd.com` / `item.m.jd.com` | `item.jd.com/{id}.html` |

- Replies with **plain URLs** only (easy to copy).
- Stays silent when the message has no supported links.
- Optional **private mode**: only allowlisted users get any reply (see below).

## Layout

```
.
├─ edge-functions/
│  ├─ api/
│  │  ├─ telegram.js    # POST /api/telegram (webhook)
│  │  └─ health.js      # GET /api/health
│  └─ lib/              # link rewrite, bilibili resolve, allowlist
├─ public/index.html    # optional landing page
├─ edgeone.json
├─ .env.example
├─ LICENSE              # MIT
└─ package.json
```

## EdgeOne build settings

| Field | Value |
|-------|--------|
| Root directory | `./` |
| Build / install command | leave empty |
| Output directory | **`public`** |

`edgeone.json` sets `"outputDirectory": "public"`.

## Quick start

### 1. Create a bot

Use [@BotFather](https://t.me/BotFather) → `/newbot` and copy the **HTTP API token**.

### 2. Deploy

1. Import this repository into [EdgeOne Makers](https://console.tencentcloud.com/edgeone/makers) (or your preferred host that runs the same `edge-functions` layout).
2. Configure environment variables (host console — **never commit secrets**):

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `BOT_TOKEN` | **yes** | — | BotFather API token |
| `WEBHOOK_SECRET` | recommended | — | Random string; must match `setWebhook` `secret_token` |
| `PRIVILEGED_ONLY` | no | `false` | When `true`, only privileged users receive replies |
| `BOOTSTRAP_PRIVILEGED_IDS` | no* | empty | Comma-separated Telegram user ids (*needed if `PRIVILEGED_ONLY=true`) |

**KV is optional.** You do **not** need to bind KV for a normal public bot, or for private mode with a fixed allowlist in `BOOTSTRAP_PRIVILEGED_IDS`.

3. Deploy and note the HTTPS origin (e.g. `https://your-app.edgeone.app`).

### 3. Set the webhook

```bash
export BOT_TOKEN='...'
export WEBHOOK_SECRET='...'   # same as env, if set
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

- `GET https://YOUR_DOMAIN/api/health` → `{"ok":true,...}`
- In Telegram: `/start`, then paste an `x.com` or `b23.tv` link

## Commands

| Command | Audience | Action |
|---------|----------|--------|
| `/help` | everyone who can talk to the bot | usage |
| `/whoami` | same | numeric Telegram user id |

When `PRIVILEGED_ONLY=true`, non-allowlisted users get **no** replies (including commands).

### Optional allowlist admin commands

Not listed in `/help`. Only users already on the allowlist can use them; others get silence.

| Command | Requires | Action |
|---------|----------|--------|
| `/status` | privileged | show mode + whether KV is bound |
| `/grant <id>` | privileged + **PRIV_KV** | add user to KV allowlist |
| `/revoke <id>` | privileged + **PRIV_KV** | remove from KV |
| `/list` | privileged | list bootstrap + KV ids |

## Private mode (`PRIVILEGED_ONLY`)

| Goal | Configuration |
|------|----------------|
| Open bot (default) | omit `PRIVILEGED_ONLY` or set `false` — **no KV needed** |
| Only you / a fixed list | `PRIVILEGED_ONLY=true` and `BOOTSTRAP_PRIVILEGED_IDS=111,222` — **no KV needed** |
| Dynamic allowlist | bind EdgeOne KV as variable name **`PRIV_KV`**, keep at least one bootstrap id who can `/grant` others |

Discover your user id with `/whoami` while the bot is still open (`PRIVILEGED_ONLY` off), then enable private mode and redeploy.

## Security

- Never commit `.env` or real tokens (see `.gitignore` and `.env.example`).
- Prefer `WEBHOOK_SECRET` so random clients cannot POST fake updates to your webhook URL.
- If a token leaks: BotFather → revoke → update host env → `setWebhook` again.

## Acknowledgments

- [FxEmbed](https://github.com/FxEmbed/FxEmbed) — FixupX / FxTwitter / FxBluesky  
- [fxzhihu](https://github.com/frostming/fxzhihu) — Zhihu fix instances  
- [b23.tv-tools](https://github.com/SunsetMkt/b23.tv-tools), [b23.wtf](https://github.com/nicholascw/b23.wtf) — short-link expansion & tracking cleanup ideas  
- [EdgeOne Makers](https://pages.edgeone.ai/) — hosting platform  
- Development assistance from **Grok** ([xAI](https://x.ai/))

## License

[MIT](./LICENSE) © 2026 [Boe Xoel](https://github.com/BoeXoel)
