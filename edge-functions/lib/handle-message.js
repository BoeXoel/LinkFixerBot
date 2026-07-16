import { handleCommand } from './commands.js';
import { convertMessageLinks, uniqueXStatusIds } from './links.js';
import { isPrivileged } from './privilege.js';
import { extractAndSendStatusMedia } from './fx-twitter.js';
import { escapeHtml } from './html.js';

/**
 * Process a Telegram Message (business logic, platform-agnostic aside from ctx).
 *
 * @param {object} message
 * @param {object} ctx
 * @param {ReturnType<import('./telegram-api.js').createTelegram>} ctx.api
 * @param {ReturnType<import('./config.js').loadConfig>} ctx.config
 * @param {object|null} ctx.kv
 */
export async function handleMessage(message, ctx) {
  if (!message || message.from?.is_bot) return;

  if (message.text?.startsWith('/')) {
    const handled = await handleCommand(message, ctx);
    if (handled) return;
  }

  const links = convertMessageLinks(message);
  const social = links.filter((l) => l.kind !== 'other');
  if (!social.length) return;

  const { api, config, kv } = ctx;
  const chatId = message.chat.id;
  const replyTo = message.message_id;
  const changed = social.filter((l) => l.changed && l.converted);
  const priv = await isPrivileged(message.from?.id, config, kv);
  const statusIds = priv ? uniqueXStatusIds(social) : [];

  if (changed.length) {
    const lines = changed.map((l) => {
      const tag =
        l.kind === 'x' ? 'X' : l.kind === 'bluesky' ? 'Bsky' : l.kind === 'zhihu' ? '知乎' : '';
      return `✅ <b>${tag}</b>\n${escapeHtml(l.converted)}`;
    });

    await api.sendMessage({
      chat_id: chatId,
      text: lines.join('\n\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_to_message_id: replyTo,
      allow_sending_without_reply: true,
    });
  }

  if (!priv || !statusIds.length) return;

  for (const statusId of statusIds) {
    const fixLink =
      social.find((l) => l.statusId === statusId && l.converted)?.converted ||
      social.find((l) => l.statusId === statusId)?.original;

    try {
      const result = await extractAndSendStatusMedia({
        api,
        chatId,
        statusId,
        apiBase: config.fxTwitterApi,
        maxMedia: config.maxMediaPerStatus,
        mediaMode: config.mediaMode,
        replyToMessageId: replyTo,
        fixLink,
      });
      if (!result.ok) {
        console.warn('media extract failed', statusId, result.error);
        await api.sendMessage({
          chat_id: chatId,
          text: `⚠️ Could not extract media for <code>${statusId}</code>: ${escapeHtml(result.error)}`,
          parse_mode: 'HTML',
          reply_to_message_id: replyTo,
          allow_sending_without_reply: true,
          disable_web_page_preview: true,
        });
      }
    } catch (e) {
      console.error('media extract error', statusId, e);
      await api.sendMessage({
        chat_id: chatId,
        text: `⚠️ Media extraction error for <code>${statusId}</code>.`,
        parse_mode: 'HTML',
        reply_to_message_id: replyTo,
        allow_sending_without_reply: true,
      });
    }
  }
}
