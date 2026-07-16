import {
  isPrivileged,
  grantPrivilege,
  revokePrivilege,
  listPrivileged,
} from './privilege.js';
import { escapeHtml } from './html.js';

const HELP = `🔗 <b>Link Fixer</b>

Send a share link from <b>X/Twitter</b>, <b>Bluesky</b>, or <b>Zhihu</b> — I rewrite it to a public fix instance:

• <code>x.com</code> → <code>fixupx.com</code>
• <code>twitter.com</code> → <code>fxtwitter.com</code>
• <code>bsky.app</code> → <code>fxbsky.app</code>
• <code>zhihu.com</code> → <code>fxzhihu.com</code>

⭐ <b>Privileged users</b>: for X posts with media, I also try to pull photos/videos via the FxEmbed API and send them as Telegram media (falls back to the link if that fails).

<b>Commands</b>
/help — this message
/whoami — your Telegram user id
/status — whether you are privileged
/grant &lt;user_id&gt; — grant privilege (privileged only)
/revoke &lt;user_id&gt; — revoke privilege (privileged only)
/list — list privileged user ids (privileged only)`;

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

  const [head, ...rest] = text.split(/\s+/);
  const cmd = head.split('@')[0].toLowerCase();
  const arg = rest.join(' ').trim();
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const { api, config, kv } = ctx;

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

    case '/status': {
      const priv = await isPrivileged(fromId, config, kv);
      await api.sendMessage({
        chat_id: chatId,
        text: priv
          ? '⭐ You are on the privilege list (link convert + X media).'
          : 'You are a normal user (link convert only).',
      });
      return true;
    }

    case '/grant': {
      if (!(await isPrivileged(fromId, config, kv))) {
        await api.sendMessage({ chat_id: chatId, text: 'Not allowed.' });
        return true;
      }
      const target = parseUserId(arg, message);
      if (!target) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Usage: /grant &lt;user_id&gt;  (or reply to a user with /grant)',
          parse_mode: 'HTML',
        });
        return true;
      }
      try {
        await grantPrivilege(target, `by ${fromId}`, kv);
        await api.sendMessage({
          chat_id: chatId,
          text: `Granted privilege to <code>${target}</code>.`,
          parse_mode: 'HTML',
        });
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Grant failed: ${escapeHtml(e?.message || e)}. Bind KV as PRIV_KV?`,
          parse_mode: 'HTML',
        });
      }
      return true;
    }

    case '/revoke': {
      if (!(await isPrivileged(fromId, config, kv))) {
        await api.sendMessage({ chat_id: chatId, text: 'Not allowed.' });
        return true;
      }
      const target = parseUserId(arg, message);
      if (!target) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Usage: /revoke &lt;user_id&gt;',
          parse_mode: 'HTML',
        });
        return true;
      }
      try {
        await revokePrivilege(target, kv);
        await api.sendMessage({
          chat_id: chatId,
          text: `Revoked privilege from <code>${target}</code>.`,
          parse_mode: 'HTML',
        });
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Revoke failed: ${escapeHtml(e?.message || e)}`,
          parse_mode: 'HTML',
        });
      }
      return true;
    }

    case '/list': {
      if (!(await isPrivileged(fromId, config, kv))) {
        await api.sendMessage({ chat_id: chatId, text: 'Not allowed.' });
        return true;
      }
      try {
        const rows = await listPrivileged(kv);
        const boot = config.bootstrapPrivilegedIds || [];
        const lines = [];
        if (boot.length) {
          lines.push('<b>Bootstrap</b>');
          for (const id of boot) lines.push(`• <code>${id}</code>`);
        }
        if (rows.length) {
          lines.push('<b>KV</b>');
          for (const r of rows) {
            lines.push(
              `• <code>${r.tgId}</code>${r.note ? ` — ${escapeHtml(r.note)}` : ''}`,
            );
          }
        }
        if (!lines.length) {
          lines.push(
            'No privileged users yet. Set <code>BOOTSTRAP_PRIVILEGED_IDS</code> or bind KV.',
          );
        }
        await api.sendMessage({
          chat_id: chatId,
          text: lines.join('\n'),
          parse_mode: 'HTML',
        });
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: `List failed: ${escapeHtml(e?.message || e)}`,
          parse_mode: 'HTML',
        });
      }
      return true;
    }

    default:
      return false;
  }
}

function parseUserId(arg, message) {
  if (arg && /^\d+$/.test(arg)) return Number(arg);
  const replyFrom = message.reply_to_message?.from?.id;
  if (replyFrom) return Number(replyFrom);
  return null;
}
