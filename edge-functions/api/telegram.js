/**
 * Telegram Bot webhook endpoint (Edge Function).
 *
 * Route: POST /api/telegram
 *
 * Env:
 *   BOT_TOKEN                  — BotFather API token (required)
 *   WEBHOOK_SECRET             — optional; must match setWebhook secret_token
 *   PRIVILEGED_ONLY            — "true" to allow only privileged users (default off)
 *   BOOTSTRAP_PRIVILEGED_IDS   — comma-separated Telegram user ids (allowlist seed)
 *
 * Optional KV binding (only if you use /grant, /revoke, or dynamic allowlist):
 *   PRIV_KV
 */

import { loadConfig } from '../lib/config.js';
import { createTelegram } from '../lib/telegram-api.js';
import { handleUpdate } from '../lib/handle-update.js';

/**
 * Resolve optional KV binding. EdgeOne may inject PRIV_KV as a global
 * and/or under env.PRIV_KV.
 */
function resolveKv(env) {
  try {
    const g = globalThis.PRIV_KV;
    if (g) return g;
  } catch {
    /* ignore */
  }
  if (env?.PRIV_KV) return env.PRIV_KV;
  return null;
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  const config = loadConfig(env || {});

  if (!config.botToken) {
    console.error('BOT_TOKEN missing');
    return new Response('BOT_TOKEN not configured', { status: 500 });
  }

  if (config.webhookSecret) {
    const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (header !== config.webhookSecret) {
      return new Response('unauthorized', { status: 401 });
    }
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const api = createTelegram(config.botToken);
  const kv = resolveKv(env);
  const ctx = { api, config, kv };

  const task = handleUpdate(update, ctx).catch((err) => {
    console.error('handleUpdate error', err);
  });

  // Prefer fast 200 for Telegram when waitUntil is available
  if (typeof waitUntil === 'function') {
    waitUntil(task);
    return new Response('ok');
  }

  await task;
  return new Response('ok');
}

/** Health / manual check */
export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'link-fixer',
      endpoint: 'telegram webhook — POST only',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
