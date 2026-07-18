/**
 * Detect share links and rewrite to cleaner / fix-instance URLs.
 * Sync rewrites: X, Bluesky, Zhihu, bilibili.com trackers.
 * Async: b23.tv short links (see convertMessageLinks).
 */

import {
  isB23Host,
  isBilibiliHost,
  bilibiliNeedsClean,
  cleanBilibiliUrl,
  resolveB23,
} from './bilibili.js';

const STATUS_ID_RE = /\/(?:status|statuses)\/(\d{5,20})(?:\/|$|\?|#)/i;

/** Match absolute http(s) URLs in free text (fallback when entities are missing). */
const LOOSE_URL_RE =
  /https?:\/\/(?:www\.)?(?:(?:mobile\.)?(?:x|twitter)\.com|t\.co|bsky\.app|fxbsky\.app|fxtwitter\.com|fixupx\.com|vxtwitter\.com|twittpr\.com|(?:www\.)?zhihu\.com|zhuanlan\.zhihu\.com|fxzhihu\.com|zhuanlan\.fxzhihu\.com|b23\.tv|bili2233\.cn|bili2233\.com|(?:[\w-]+\.)?bilibili\.com)[^\s<>"')\]]*/gi;

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
 * Synchronous conversion (no network).
 * b23 short links return kind bilibili with needsResolve=true.
 *
 * @param {string} raw
 * @returns {{ original: string, converted: string | null, kind: string, statusId: string | null, changed: boolean, needsResolve?: boolean }}
 */
export function convertLink(raw) {
  const url = tryParse(raw);
  if (!url) {
    return { original: raw, converted: null, kind: 'other', statusId: null, changed: false };
  }

  const host = hostOf(url.hostname);
  let kind = 'other';
  let convertedHost = null;

  // --- Bilibili short link: resolve async ---
  if (isB23Host(url.hostname) || isB23Host(host)) {
    return {
      original: raw,
      converted: null,
      kind: 'bilibili',
      statusId: null,
      changed: false,
      needsResolve: true,
    };
  }

  // --- Bilibili long link: strip trackers only ---
  if (isBilibiliHost(url.hostname) || isBilibiliHost(host)) {
    if (bilibiliNeedsClean(url.toString())) {
      const cleaned = cleanBilibiliUrl(url);
      return {
        original: raw,
        converted: cleaned,
        kind: 'bilibili',
        statusId: null,
        changed: cleaned !== raw && cleaned !== url.toString()
          ? true
          : cleaned.replace(/\/$/, '') !== raw.replace(/\/$/, ''),
      };
    }
    return {
      original: raw,
      converted: null,
      kind: 'bilibili',
      statusId: null,
      changed: false,
    };
  }

  // --- X / Twitter ---
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
 * Convert all extractable URLs, including async b23 resolution.
 * @param {object} message
 */
export async function convertMessageLinks(message) {
  const urls = extractUrls(message);
  const results = await Promise.all(
    urls.map(async (raw) => {
      const base = convertLink(raw);
      if (base.needsResolve && base.kind === 'bilibili') {
        const resolved = await resolveB23(raw);
        if (resolved.ok) {
          return {
            original: raw,
            converted: resolved.url,
            kind: 'bilibili',
            statusId: null,
            changed: true,
          };
        }
        console.warn('b23 resolve failed', raw, resolved.error);
        return {
          original: raw,
          converted: null,
          kind: 'bilibili',
          statusId: null,
          changed: false,
          error: resolved.error,
        };
      }
      // Normalize bilibili "changed" when only cleaning differs by slash
      if (base.kind === 'bilibili' && base.converted) {
        const a = base.original.replace(/\/?(\?|$)/, '$1');
        const b = base.converted;
        base.changed = a !== b && !urlsEqualLoose(base.original, base.converted);
      }
      return base;
    }),
  );
  return results;
}

function urlsEqualLoose(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.hostname.replace(/^www\./, '') === ub.hostname.replace(/^www\./, '') &&
      ua.pathname.replace(/\/$/, '') === ub.pathname.replace(/\/$/, '') &&
      ua.search === ub.search
    );
  } catch {
    return a === b;
  }
}

