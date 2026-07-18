import { handleCommand } from './commands.js';
import { convertMessageLinks } from './links.js';
import { isPrivileged } from './privilege.js';

/**
 * Process a Telegram Message: rewrite supported share links.
 *
 * When config.privilegedOnly is true, non-privileged users get no replies
 * (including commands).
 *
 * @param {object} message
 * @param {object} ctx
 * @param {ReturnType<import('./telegram-api.js').createTelegram>} ctx.api
 * @param {ReturnType<import('./config.js').loadConfig>} ctx.config
 * @param {object|null} ctx.kv
 */
export async function handleMessage(message, ctx) {
  if (!message || message.from?.is_bot) return;

  const { api, config, kv } = ctx;
  const fromId = message.from?.id;

  if (config.privilegedOnly) {
    const ok = await isPrivileged(fromId, config, kv);
    if (!ok) return;
  }

  if (message.text?.startsWith('/')) {
    const handled = await handleCommand(message, ctx);
    if (handled) return;
  }

  const links = await convertMessageLinks(message);
  const social = links.filter((l) => l.kind !== 'other');
  if (!social.length) return;

  const chatId = message.chat.id;
  const replyTo = message.message_id;
  const changed = social.filter((l) => l.changed && l.converted);

  if (!changed.length) return;

  // Plain converted URLs only — easy to read and copy.
  const text = changed.map((l) => l.converted).join('\n\n');

  await api.sendMessage({
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
    reply_to_message_id: replyTo,
    allow_sending_without_reply: true,
  });
}
