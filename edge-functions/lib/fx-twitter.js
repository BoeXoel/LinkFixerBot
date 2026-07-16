import { TelegramApiError } from './telegram-api.js';
import { escapeHtml } from './html.js';

/**
 * @typedef {{ type: 'photo' | 'video' | 'animation', url: string, width?: number, height?: number }} MediaItem
 */

/**
 * @param {string} statusId
 * @param {string} apiBase
 */
export async function fetchStatus(statusId, apiBase) {
  const url = `${apiBase.replace(/\/$/, '')}/2/status/${encodeURIComponent(statusId)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return { ok: false, error: `network: ${e?.message || e}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `invalid JSON (HTTP ${res.status})` };
  }

  const code = data?.code ?? res.status;
  if (code !== 200 || !data?.status || data.status.type === 'tombstone') {
    const reason =
      data?.status?.message ||
      data?.message ||
      data?.status?.reason ||
      `HTTP ${code}`;
    return { ok: false, error: String(reason), code };
  }

  return { ok: true, status: data.status };
}

/**
 * @param {object} status
 * @param {number} maxItems
 * @returns {MediaItem[]}
 */
export function extractMedia(status, maxItems = 10) {
  const media = status?.media;
  if (!media) return [];

  /** @type {MediaItem[]} */
  const items = [];

  if (Array.isArray(media.photos)) {
    for (const p of media.photos) {
      if (p?.url) {
        items.push({
          type: p.type === 'gif' ? 'animation' : 'photo',
          url: p.url,
          width: p.width,
          height: p.height,
        });
      }
    }
  }

  if (Array.isArray(media.videos)) {
    for (const v of media.videos) {
      const url = pickBestVideoUrl(v);
      if (!url) continue;
      items.push({
        type: v.type === 'gif' ? 'animation' : 'video',
        url,
        width: v.width,
        height: v.height,
      });
    }
  }

  if (items.length === 0 && Array.isArray(media.all)) {
    for (const m of media.all) {
      if (!m?.url) continue;
      if (m.type === 'photo') {
        items.push({ type: 'photo', url: m.url, width: m.width, height: m.height });
      } else if (m.type === 'video' || m.type === 'gif') {
        const url = m.url || pickBestVideoUrl(m);
        if (url) {
          items.push({
            type: m.type === 'gif' ? 'animation' : 'video',
            url,
            width: m.width,
            height: m.height,
          });
        }
      }
    }
  }

  if (items.length === 0 && media.mosaic?.formats?.jpeg) {
    items.push({ type: 'photo', url: media.mosaic.formats.jpeg });
  } else if (items.length === 0 && media.mosaic?.url) {
    items.push({ type: 'photo', url: media.mosaic.url });
  }

  return items.slice(0, maxItems);
}

function pickBestVideoUrl(video) {
  if (!video) return null;
  const formats = Array.isArray(video.formats) ? video.formats : [];
  const mp4s = formats
    .filter((f) => f?.url && (f.container === 'mp4' || /\.mp4(\?|$)/i.test(f.url)))
    .filter((f) => f.container !== 'm3u8' && !/\.m3u8/i.test(f.url || ''))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (mp4s.length) return mp4s[0].url;
  if (video.url && !/\.m3u8/i.test(video.url)) return video.url;
  return null;
}

/**
 * Download remote media bytes (Edge runtime supports binary responses).
 * @param {string} url
 * @returns {Promise<{ ok: true, bytes: ArrayBuffer, contentType: string } | { ok: false, error: string }>}
 */
async function downloadBytes(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const bytes = await res.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) return { ok: false, error: 'empty body' };
    // Soft cap ~45MB to stay under Telegram practical limits
    if (bytes.byteLength > 45 * 1024 * 1024) {
      return { ok: false, error: 'file too large' };
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return { ok: true, bytes, contentType };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * @param {object} opts
 * @param {ReturnType<import('./telegram-api.js').createTelegram>} opts.api
 * @param {number|string} opts.chatId
 * @param {MediaItem[]} opts.items
 * @param {string} [opts.caption]
 * @param {number} [opts.replyToMessageId]
 * @param {'upload'|'url'} opts.mediaMode
 */
export async function sendMediaItems({
  api,
  chatId,
  items,
  caption,
  replyToMessageId,
  mediaMode,
}) {
  const errors = [];
  let sent = 0;
  let failed = 0;

  if (!items.length) return { sent: 0, failed: 0, errors: ['no media'] };

  // URL mode: multi-photo album
  if (mediaMode === 'url') {
    const allPhotos = items.every((i) => i.type === 'photo');
    if (allPhotos && items.length > 1) {
      try {
        const media = items.map((item, idx) => ({
          type: 'photo',
          media: item.url,
          ...(idx === 0 && caption ? { caption, parse_mode: 'HTML' } : {}),
        }));
        await api.sendMediaGroup({
          chat_id: chatId,
          media,
          ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
        });
        return { sent: items.length, failed: 0, errors: [] };
      } catch (e) {
        console.warn('sendMediaGroup failed', e?.description || e);
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cap = i === 0 ? caption : undefined;
    const reply = i === 0 ? replyToMessageId : undefined;
    try {
      if (mediaMode === 'upload') {
        await sendOneUpload(api, { chatId, item, caption: cap, replyToMessageId: reply });
      } else {
        await sendOneUrl(api, { chatId, item, caption: cap, replyToMessageId: reply });
      }
      sent++;
    } catch (e) {
      // If upload path fails, try URL once
      if (mediaMode === 'upload') {
        try {
          await sendOneUrl(api, { chatId, item, caption: cap, replyToMessageId: reply });
          sent++;
          continue;
        } catch (e2) {
          failed++;
          const msg =
            e2 instanceof TelegramApiError
              ? e2.description
              : String(e2?.message || e2 || e?.message || e);
          errors.push(msg);
          console.warn('send media failed', item.type, item.url, msg);
          continue;
        }
      }
      failed++;
      const msg = e instanceof TelegramApiError ? e.description : String(e?.message || e);
      errors.push(msg);
      console.warn('send media failed', item.type, item.url, msg);
    }
  }

  return { sent, failed, errors };
}

async function sendOneUrl(api, { chatId, item, caption, replyToMessageId }) {
  const base = {
    chat_id: chatId,
    ...(caption ? { caption, parse_mode: 'HTML' } : {}),
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    allow_sending_without_reply: true,
  };
  if (item.type === 'photo') return api.sendPhoto({ ...base, photo: item.url });
  if (item.type === 'video') {
    return api.sendVideo({ ...base, video: item.url, supports_streaming: true });
  }
  if (item.type === 'animation') return api.sendAnimation({ ...base, animation: item.url });
  return api.sendDocument({ ...base, document: item.url });
}

async function sendOneUpload(api, { chatId, item, caption, replyToMessageId }) {
  const dl = await downloadBytes(item.url);
  if (!dl.ok) throw new Error(`download failed: ${dl.error}`);

  const common = {
    chat_id: chatId,
    bytes: dl.bytes,
    caption,
    parse_mode: caption ? 'HTML' : undefined,
    reply_to_message_id: replyToMessageId,
    allow_sending_without_reply: true,
  };

  if (item.type === 'photo') {
    return api.sendPhotoUpload({ ...common, filename: filenameFromUrl(item.url, 'photo.jpg') });
  }
  if (item.type === 'video') {
    return api.sendVideoUpload({ ...common, filename: filenameFromUrl(item.url, 'video.mp4') });
  }
  if (item.type === 'animation') {
    return api.sendAnimationUpload({
      ...common,
      filename: filenameFromUrl(item.url, 'animation.gif'),
    });
  }
  return api.sendDocument({
    chat_id: chatId,
    document: item.url,
    ...(caption ? { caption, parse_mode: 'HTML' } : {}),
  });
}

function filenameFromUrl(url, fallback) {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop() || '';
    if (last && last.includes('.')) return last.split('?')[0];
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * @param {object} opts
 * @param {ReturnType<import('./telegram-api.js').createTelegram>} opts.api
 * @param {number|string} opts.chatId
 * @param {string} opts.statusId
 * @param {string} opts.apiBase
 * @param {number} opts.maxMedia
 * @param {'upload'|'url'} opts.mediaMode
 * @param {number} [opts.replyToMessageId]
 * @param {string} [opts.fixLink]
 */
export async function extractAndSendStatusMedia({
  api,
  chatId,
  statusId,
  apiBase,
  maxMedia,
  mediaMode,
  replyToMessageId,
  fixLink,
}) {
  const result = await fetchStatus(statusId, apiBase);
  if (!result.ok) {
    return { ok: false, error: result.error, sent: 0 };
  }

  const items = extractMedia(result.status, maxMedia);
  if (!items.length) {
    return { ok: false, error: 'post has no extractable media', sent: 0, status: result.status };
  }

  const author = result.status.author?.screen_name
    ? `@${result.status.author.screen_name}`
    : '';
  const textPreview = (result.status.text || '').trim();
  const short = textPreview.length > 200 ? `${textPreview.slice(0, 200)}…` : textPreview;
  const parts = [];
  if (author) parts.push(`<b>${escapeHtml(author)}</b>`);
  if (short) parts.push(escapeHtml(short));
  if (fixLink) parts.push(`<a href="${escapeHtml(fixLink)}">link</a>`);
  const caption = parts.join('\n').slice(0, 1024);

  const sendResult = await sendMediaItems({
    api,
    chatId,
    items,
    caption: caption || undefined,
    replyToMessageId,
    mediaMode,
  });

  if (sendResult.sent === 0) {
    return {
      ok: false,
      error: sendResult.errors[0] || 'failed to send media',
      sent: 0,
      status: result.status,
    };
  }

  return {
    ok: true,
    sent: sendResult.sent,
    failed: sendResult.failed,
    status: result.status,
  };
}
