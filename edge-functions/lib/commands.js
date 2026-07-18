import {
  isPrivileged,
  grantPrivilege,
  revokePrivilege,
  listPrivileged,
} from './privilege.js';

/** Public help — no mention of private-mode admin commands. */
const HELP = `🔗 <b>Link Fixer</b>

Send a share link — I rewrite it to a cleaner public URL:

• <code>x.com</code> → <code>fixupx.com</code>
• <code>twitter.com</code> → <code>fxtwitter.com</code>
• <code>bsky.app</code> → <code>fxbsky.app</code>
• <code>zhihu.com</code> → <code>fxzhihu.com</code>
• <code>b23.tv</code> → clean <code>bilibili.com</code> (tracking removed)

Just paste one or more links. I only reply when a supported link is found.

<b>Commands</b>
/help — this message
/whoami — your Telegram user id`;

/**
 * @param {object} message
 * @param {object} ctx
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

    // Undocumented admin helpers (for allowlist / PRIVILEGED_ONLY). Silent if not privileged.
    case '/status': {
      if (!(await isPrivileged(fromId, config, kv))) return true;
      const mode = config.privilegedOnly ? 'PRIVILEGED_ONLY=on' : 'PRIVILEGED_ONLY=off';
      const kvState = kv ? 'KV bound' : 'KV not bound';
      await api.sendMessage({
        chat_id: chatId,
        text: `Privileged.\n${mode}\n${kvState}`,
      });
      return true;
    }

    case '/grant': {
      if (!(await isPrivileged(fromId, config, kv))) return true;
      const target = parseUserId(arg, message);
      if (!target) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Usage: /grant &lt;user_id&gt; (or reply with /grant). Requires PRIV_KV.',
          parse_mode: 'HTML',
        });
        return true;
      }
      try {
        await grantPrivilege(target, `by ${fromId}`, kv);
        await api.sendMessage({
          chat_id: chatId,
          text: `Granted <code>${target}</code>.`,
          parse_mode: 'HTML',
        });
      } catch (e) {
        await api.sendMessage({
          chat_id: chatId,
          text: `Grant failed: ${escapeHtml(e?.message || e)}`,
          parse_mode: 'HTML',
        });
      }
      return true;
    }

    case '/revoke': {
      if (!(await isPrivileged(fromId, config, kv))) return true;
      const target = parseUserId(arg, message);
      if (!target) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Usage: /revoke &lt;user_id&gt;. Requires PRIV_KV.',
          parse_mode: 'HTML',
        });
        return true;
      }
      try {
        await revokePrivilege(target, kv);
        await api.sendMessage({
          chat_id: chatId,
          text: `Revoked <code>${target}</code>.`,
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
      if (!(await isPrivileged(fromId, config, kv))) return true;
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
        if (!lines.length) lines.push('(empty)');
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
