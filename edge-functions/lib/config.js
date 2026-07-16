/**
 * Runtime config from EdgeOne env bindings.
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env = {}) {
  const botToken = (env.BOT_TOKEN || '').trim();
  const webhookSecret = (env.WEBHOOK_SECRET || '').trim();
  const bootstrap = String(env.BOOTSTRAP_PRIVILEGED_IDS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));

  return {
    botToken,
    webhookSecret,
    bootstrapPrivilegedIds: bootstrap,
    /** FxTwitter / FixupX JSON API */
    fxTwitterApi: env.FX_TWITTER_API || 'https://api.fxtwitter.com',
    maxMediaPerStatus: Number(env.MAX_MEDIA_PER_STATUS) || 10,
    /**
     * Prefer downloading media bytes and re-uploading to Telegram (more reliable).
     * Set MEDIA_MODE=url to only pass remote URLs to Bot API.
     */
    mediaMode: (env.MEDIA_MODE || 'upload').toLowerCase() === 'url' ? 'url' : 'upload',
  };
}

export function assertBotToken(config) {
  if (!config.botToken) {
    throw new Error('BOT_TOKEN is not configured');
  }
}
