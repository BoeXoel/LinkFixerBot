# Link Fixer — EdgeOne Makers

Telegram bot that rewrites social share links to public fix instances, deployed on
[EdgeOne Makers](https://pages.edgeone.ai/) Edge Functions (Cloudflare Workers–like).

## Publish this folder as a GitHub repo

This directory is meant to be the **repository root** (not the parent monorepo).

```bash
cd edgeone   # or clone after you push only this tree

git init
git add .
git status   # confirm .env is NOT listed

git commit -m "Initial commit: Link Fixer EdgeOne bot"
git branch -M main
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Then in EdgeOne Makers: **Import Git repository** → select this repo → deploy.

**Do not commit secrets.** Use EdgeOne project environment variables for `BOT_TOKEN`,
`WEBHOOK_SECRET`, and `BOOTSTRAP_PRIVILEGED_IDS`. See `.env.example`.

### What is ignored

See [`.gitignore`](.gitignore): `node_modules/`, `.env*` (keeps `.env.example`), `.edgeone/`, logs, OS/IDE junk.

### Files you should keep in git

| Path | Purpose |
|------|---------|
| `edge-functions/` | Webhook + bot logic |
| `public/` | Static landing page |
| `edgeone.json` | Project metadata |
| `package.json` | Name / scripts (optional CLI) |
| `.env.example` | Documented env keys only |
| `README.md` | Deploy instructions |

## Features

- **Everyone:** rewrite links  
  - `x.com` → `fixupx.com`  
  - `twitter.com` → `fxtwitter.com`  
  - `bsky.app` → `fxbsky.app`  
  - `zhihu.com` → `fxzhihu.com` (incl. zhuanlan)
- **Privileged users:** for X posts, call [FxEmbed API](https://docs.fxembed.com/api/twitter/),
  download media, and re-upload to Telegram (falls back to URL send, then error text).

## Layout

```
edgeone/
├─ edge-functions/
│  ├─ api/
│  │  ├─ telegram.js   # webhook POST /api/telegram
│  │  └─ health.js     # GET /api/health
│  └─ lib/             # business logic
├─ public/index.html   # landing page
├─ edgeone.json
├─ .env.example
└─ package.json
```

## Setup

### 1. Create the bot

In [@BotFather](https://t.me/BotFather): `/newbot`, copy the **HTTP API token**.

### 2. Configure EdgeOne

1. Create a Makers / Pages project from this folder (Git import or CLI).
2. Set environment variables:

| Name | Required | Description |
|------|----------|-------------|
| `BOT_TOKEN` | yes | BotFather API token |
| `WEBHOOK_SECRET` | recommended | Random string for `setWebhook` secret |
| `BOOTSTRAP_PRIVILEGED_IDS` | recommended | Your numeric user id(s), comma-separated |
| `MEDIA_MODE` | no | `upload` (default) or `url` |
| `FX_TWITTER_API` | no | Default `https://api.fxtwitter.com` |

3. **KV (privilege list)**  
   - Console → Storage → KV → create namespace  
   - Bind to this project with variable name **`PRIV_KV`**  
   - Without KV, only bootstrap IDs are privileged (`/grant` needs KV).

### 3. Deploy

```bash
# optional local tooling
npm install -g edgeone
cd edgeone
edgeone makers dev    # local debug (see EdgeOne docs)

# deploy via Git push, console upload, or CLI — follow current EdgeOne docs
```

Note the public HTTPS origin, e.g. `https://link-fixer-xxxx.edgeone.app`.

### 4. Point Telegram webhook

Replace placeholders:

```bash
export BOT_TOKEN='...'
export WEBHOOK_SECRET='...'   # same as env
export BASE='https://YOUR_DOMAIN'

curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${BASE}/api/telegram" \
  -d "secret_token=${WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\"]"
```

Check:

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

### 5. Smoke test

- Open the bot → `/start` or `/whoami`
- Put your id in `BOOTSTRAP_PRIVILEGED_IDS`, redeploy
- Send an `https://x.com/.../status/...` link

## Commands

| Command | Who | Action |
|---------|-----|--------|
| `/help` | all | help text |
| `/whoami` | all | your Telegram id |
| `/status` | all | privilege check |
| `/grant <id>` | privileged | add to KV |
| `/revoke <id>` | privileged | remove from KV |
| `/list` | privileged | list bootstrap + KV |

## Notes

- Webhook body limit on Edge Functions is **1 MB** (fine for text link messages).
- Media path uses **download + multipart upload** by default so Telegram does not need to fetch X CDNs itself.
- `waitUntil` is used when available so Telegram gets a fast `ok` while media work continues.
- Do not commit `.env` or real tokens.
