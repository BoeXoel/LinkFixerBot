/**
 * Thin Telegram Bot API client via fetch.
 * All methods unwrap { ok, result } and throw on failure.
 */

export class TelegramApiError extends Error {
  /**
   * @param {number} code
   * @param {string} description
   * @param {string} method
   * @param {object} [parameters]
   */
  constructor(code, description, method, parameters) {
    super(description || `Telegram API error ${code}`);
    this.name = 'TelegramApiError';
    this.code = code;
    this.description = description;
    this.method = method;
    this.parameters = parameters;
  }
}

/**
 * @param {string} token
 * @param {string} method
 * @param {object} [body]
 * @param {{ formData?: FormData }} [opts]
 */
export async function callTelegram(token, method, body, opts = {}) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  /** @type {RequestInit} */
  const init = { method: 'POST' };

  if (opts.formData) {
    init.body = opts.formData;
  } else {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body || {});
  }

  const res = await fetch(url, init);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new TelegramApiError(res.status, `Invalid JSON from Telegram (${res.status})`, method);
  }

  if (!data.ok) {
    throw new TelegramApiError(
      data.error_code || res.status,
      data.description || 'Unknown error',
      method,
      data.parameters,
    );
  }
  return data.result;
}

/**
 * @param {string} token
 */
export function createTelegram(token) {
  return {
    call: (method, body) => callTelegram(token, method, body),

    sendMessage: (params) => callTelegram(token, 'sendMessage', params),

    sendPhoto: (params) => callTelegram(token, 'sendPhoto', params),

    sendVideo: (params) => callTelegram(token, 'sendVideo', params),

    sendAnimation: (params) => callTelegram(token, 'sendAnimation', params),

    sendDocument: (params) => callTelegram(token, 'sendDocument', params),

    sendMediaGroup: (params) => callTelegram(token, 'sendMediaGroup', params),

    /**
     * Upload binary as photo (multipart).
     * @param {object} p
     * @param {number|string} p.chat_id
     * @param {ArrayBuffer|Uint8Array|Blob} p.bytes
     * @param {string} [p.filename]
     * @param {string} [p.caption]
     * @param {string} [p.parse_mode]
     * @param {number} [p.reply_to_message_id]
     * @param {boolean} [p.allow_sending_without_reply]
     */
    async sendPhotoUpload(p) {
      const form = new FormData();
      form.append('chat_id', String(p.chat_id));
      form.append('photo', toBlob(p.bytes, guessImageType(p.filename)), p.filename || 'photo.jpg');
      if (p.caption) form.append('caption', p.caption);
      if (p.parse_mode) form.append('parse_mode', p.parse_mode);
      if (p.reply_to_message_id != null) form.append('reply_to_message_id', String(p.reply_to_message_id));
      if (p.allow_sending_without_reply) form.append('allow_sending_without_reply', 'true');
      return callTelegram(token, 'sendPhoto', null, { formData: form });
    },

    async sendVideoUpload(p) {
      const form = new FormData();
      form.append('chat_id', String(p.chat_id));
      form.append('video', toBlob(p.bytes, 'video/mp4'), p.filename || 'video.mp4');
      form.append('supports_streaming', 'true');
      if (p.caption) form.append('caption', p.caption);
      if (p.parse_mode) form.append('parse_mode', p.parse_mode);
      if (p.reply_to_message_id != null) form.append('reply_to_message_id', String(p.reply_to_message_id));
      if (p.allow_sending_without_reply) form.append('allow_sending_without_reply', 'true');
      return callTelegram(token, 'sendVideo', null, { formData: form });
    },

    async sendAnimationUpload(p) {
      const form = new FormData();
      form.append('chat_id', String(p.chat_id));
      form.append('animation', toBlob(p.bytes, 'image/gif'), p.filename || 'animation.gif');
      if (p.caption) form.append('caption', p.caption);
      if (p.parse_mode) form.append('parse_mode', p.parse_mode);
      if (p.reply_to_message_id != null) form.append('reply_to_message_id', String(p.reply_to_message_id));
      if (p.allow_sending_without_reply) form.append('allow_sending_without_reply', 'true');
      return callTelegram(token, 'sendAnimation', null, { formData: form });
    },
  };
}

/**
 * @param {ArrayBuffer|Uint8Array|Blob} bytes
 * @param {string} type
 */
function toBlob(bytes, type) {
  if (bytes instanceof Blob) return bytes;
  const ab = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Blob([ab], { type });
}

function guessImageType(filename) {
  const n = (filename || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
