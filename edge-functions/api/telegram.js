/**
 * Telegram Bot webhook endpoint (Edge Function).
 *
 * Route: POST /api/telegram
 *
 * Env:
 *   BOT_TOKEN                 — BotFather API token
 *   WEBHOOK_SECRET            — optional; must match setWebhook secret_token
 *   BOOTSTRAP_PRIVILEGED_IDS  — comma-separated user ids
 *   MEDIA_MODE                — upload (default) | url
 *   FX_TWITTER_API            — optional override
 *
 * KV binding:
 *   PRIV_KV — namespace for privilege list (variable name when binding)
 */

import { loadConfig } from '../lib/config.js';
import { createTelegram } from '../lib/telegram-api.js';
import { handleUpdate } from '../lib/handle-update.js';

/**
 * Resolve KV binding. EdgeOne injects the bound variable as a global (e.g. PRIV_KV)
 * and may also expose env.PRIV_KV depending on runtime.
 */
function resolveKv(env) {
  try {
    // globalThis.PRIV_KV avoids ReferenceError when the binding is not declared
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

  // Verify Telegram secret_token header when configured
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

  // Extend lifetime for media download/upload when supported
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
