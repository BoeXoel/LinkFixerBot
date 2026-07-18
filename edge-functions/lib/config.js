/**
 * Runtime config from EdgeOne (or other host) environment bindings.
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

  // Default off: anyone can use the bot. When true, only privileged users get replies.
  const privilegedOnly = parseBool(env.PRIVILEGED_ONLY, false);

  return {
    botToken,
    webhookSecret,
    bootstrapPrivilegedIds: bootstrap,
    privilegedOnly,
  };
}

/**
 * @param {string | undefined} value
 * @param {boolean} fallback
 */
function parseBool(value, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

export function assertBotToken(config) {
  if (!config.botToken) {
    throw new Error('BOT_TOKEN is not configured');
  }
}
