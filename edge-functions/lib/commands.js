// Privilege admin cmds disabled while media extraction is off.
// import {
//   isPrivileged,
//   grantPrivilege,
//   revokePrivilege,
//   listPrivileged,
// } from './privilege.js';
// import { escapeHtml } from './html.js';

/** Public-facing only — never mention internal / admin capabilities. */
const HELP = `🔗 <b>Link Fixer</b>

Send a share link from <b>X/Twitter</b>, <b>Bluesky</b>, or <b>Zhihu</b> — I rewrite it to a public fix instance so previews work better in chat.

• <code>x.com</code> → <code>fixupx.com</code>
• <code>twitter.com</code> → <code>fxtwitter.com</code>
• <code>bsky.app</code> → <code>fxbsky.app</code>
• <code>zhihu.com</code> → <code>fxzhihu.com</code>

Just paste one or more links. I only reply when a supported link is found.

<b>Commands</b>
/help — this message
/whoami — your Telegram user id`;

/**
 * @param {object} message
 * @param {object} ctx
 * @param {ReturnType<import('./telegram-api.js').createTelegram>} ctx.api
 * @param {ReturnType<import('./config.js').loadConfig>} ctx.config
 * @param {object|null} ctx.kv
 * @returns {Promise<boolean>}
 */
export async function handleCommand(message, ctx) {
  const text = (message.text || '').trim();
  if (!text.startsWith('/')) return false;

  const [head] = text.split(/\s+/);
  const cmd = head.split('@')[0].toLowerCase();
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const { api } = ctx;
  // const { config, kv } = ctx;

  switch (cmd) {
    case '/start':
    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text: HELP,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return true;

    case '/whoami':
      await api.sendMessage({
        chat_id: chatId,
        text: `Your Telegram user id: <code>${fromId}</code>`,
        parse_mode: 'HTML',
      });
      return true;

    // --- Disabled with media privilege feature (restore with handle-message.js) ---
    // case '/status':
    // case '/grant':
    // case '/revoke':
    // case '/list':
    //   … see git history / privilege.js

    default:
      return false;
  }
}

// function parseUserId(arg, message) {
//   if (arg && /^\d+$/.test(arg)) return Number(arg);
//   const replyFrom = message.reply_to_message?.from?.id;
//   if (replyFrom) return Number(replyFrom);
//   return null;
// }
