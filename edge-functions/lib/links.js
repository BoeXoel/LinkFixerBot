/**
 * Detect share links (X / Twitter / Bluesky / Zhihu) and rewrite to public fix instances.
 */

const STATUS_ID_RE = /\/(?:status|statuses)\/(\d{5,20})(?:\/|$|\?|#)/i;

/** Match absolute http(s) URLs in free text (fallback when entities are missing). */
const LOOSE_URL_RE =
  /https?:\/\/(?:www\.)?(?:(?:mobile\.)?(?:x|twitter)\.com|t\.co|bsky\.app|fxbsky\.app|fxtwitter\.com|fixupx\.com|vxtwitter\.com|twittpr\.com|(?:www\.)?zhihu\.com|zhuanlan\.zhihu\.com|fxzhihu\.com|zhuanlan\.fxzhihu\.com)[^\s<>"')\]]*/gi;

/**
 * Extract raw URL strings from a Telegram Message.
 * @param {object} message
 * @returns {string[]}
 */
export function extractUrls(message) {
  const text = message.text || message.caption || '';
  const entities = message.entities || message.caption_entities || [];
  const found = [];

  for (const e of entities) {
    if (e.type === 'url') {
      found.push(text.slice(e.offset, e.offset + e.length));
    } else if (e.type === 'text_link' && e.url) {
      found.push(e.url);
    }
  }

  if (found.length === 0 && text) {
    const matches = text.match(LOOSE_URL_RE);
    if (matches) found.push(...matches);
  }

  const seen = new Set();
  const out = [];
  for (const u of found) {
    const cleaned = stripTrailingPunct(u.trim());
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function stripTrailingPunct(url) {
  return url.replace(/[),.;!?'"»]+$/g, '');
}

function tryParse(raw) {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function hostOf(hostname) {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

/**
 * @param {string} raw
 * @returns {{ original: string, converted: string | null, kind: string, statusId: string | null, changed: boolean }}
 */
export function convertLink(raw) {
  const url = tryParse(raw);
  if (!url) {
    return { original: raw, converted: null, kind: 'other', statusId: null, changed: false };
  }

  const host = hostOf(url.hostname);
  let kind = 'other';
  let convertedHost = null;

  if (
    host === 'x.com' ||
    host === 'twitter.com' ||
    host === 'mobile.x.com' ||
    host === 'mobile.twitter.com'
  ) {
    kind = 'x';
    convertedHost = host.includes('twitter') ? 'fxtwitter.com' : 'fixupx.com';
  } else if (
    host === 'fxtwitter.com' ||
    host === 'fixupx.com' ||
    host === 'vxtwitter.com' ||
    host === 'twittpr.com'
  ) {
    kind = 'x';
  } else if (host === 'bsky.app') {
    kind = 'bluesky';
    convertedHost = 'fxbsky.app';
  } else if (host === 'fxbsky.app') {
    kind = 'bluesky';
  } else if (host === 'zhihu.com') {
    kind = 'zhihu';
    convertedHost = 'fxzhihu.com';
  } else if (host === 'zhuanlan.zhihu.com') {
    kind = 'zhihu';
    convertedHost = 'zhuanlan.fxzhihu.com';
  } else if (host === 'fxzhihu.com' || host === 'zhuanlan.fxzhihu.com') {
    kind = 'zhihu';
  }

  let statusId = null;
  if (kind === 'x') {
    const m = url.pathname.match(STATUS_ID_RE);
    if (m) statusId = m[1];
  }

  if (!convertedHost) {
    return { original: raw, converted: null, kind, statusId, changed: false };
  }

  const out = new URL(url.toString());
  out.hostname = convertedHost;
  for (const key of [...out.searchParams.keys()]) {
    if (
      key === 's' ||
      key === 't' ||
      key.startsWith('utm_') ||
      key === 'ref_src' ||
      key === 'ref_url'
    ) {
      out.searchParams.delete(key);
    }
  }

  const converted = out.toString();
  return {
    original: raw,
    converted,
    kind,
    statusId,
    changed: converted !== raw,
  };
}

/**
 * @param {object} message
 */
export function convertMessageLinks(message) {
  return extractUrls(message).map(convertLink);
}

/**
 * @param {ReturnType<typeof convertLink>[]} links
 * @returns {string[]}
 */
export function uniqueXStatusIds(links) {
  const ids = [];
  const seen = new Set();
  for (const l of links) {
    if (l.kind === 'x' && l.statusId && !seen.has(l.statusId)) {
      seen.add(l.statusId);
      ids.push(l.statusId);
    }
  }
  return ids;
}
