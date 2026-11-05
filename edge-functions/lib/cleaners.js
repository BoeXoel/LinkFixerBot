/**
 * Domestic platform share-link cleaners and short-link resolvers:
 * - Xiaohongshu (小红书): xiaohongshu.com, xhslink.com
 * - WeChat Official Account (微信公众号): mp.weixin.qq.com, w.url.cn
 * - Baidu Tieba (百度贴吧): tieba.baidu.com, c.tieba.baidu.com
 * - Weibo (微博): weibo.com, m.weibo.cn, weibo.cn, t.cn
 * - Pinduoduo (拼多多): mobile.yangkeduo.com, yangkeduo.com, pinduoduo.com
 * - Taobao / Tmall (淘宝/天猫): item.taobao.com, detail.tmall.com, a.m.taobao.com, h5.m.taobao.com, m.tb.cn, tb.cn, s.click.taobao.com
 * - JD (京东): item.jd.com, item.m.jd.com, 3.cn, u.jd.com
 */

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const SHORT_HOST_KIND = new Map([
  ['xhslink.com', 'xiaohongshu'],
  ['t.cn', 'weibo'],
  ['m.tb.cn', 'taobao'],
  ['tb.cn', 'taobao'],
  ['s.click.taobao.com', 'taobao'],
  ['3.cn', 'jd'],
  ['u.jd.com', 'jd'],
  ['w.url.cn', 'weixin'],
]);

function normalizeHost(hostname) {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

/**
 * Identify if a hostname is a short-link domain handled by this module.
 * @param {string} hostname
 * @returns {string | null} platform kind or null
 */
export function getShortLinkKind(hostname) {
  const h = normalizeHost(hostname);
  return SHORT_HOST_KIND.get(h) || null;
}

/**
 * Identify platform kind for long links handled by this module.
 * @param {string} hostname
 * @returns {string | null}
 */
export function getPlatformKind(hostname) {
  const h = normalizeHost(hostname);

  if (h === 'xiaohongshu.com' || h.endsWith('.xiaohongshu.com')) {
    return 'xiaohongshu';
  }
  if (h === 'mp.weixin.qq.com') {
    return 'weixin';
  }
  if (h === 'tieba.baidu.com' || h === 'c.tieba.baidu.com' || h === 'wapp.baidu.com') {
    return 'tieba';
  }
  if (
    h === 'weibo.com' ||
    h.endsWith('.weibo.com') ||
    h === 'weibo.cn' ||
    h.endsWith('.weibo.cn')
  ) {
    return 'weibo';
  }
  if (
    h === 'yangkeduo.com' ||
    h.endsWith('.yangkeduo.com') ||
    h === 'pinduoduo.com' ||
    h.endsWith('.pinduoduo.com')
  ) {
    return 'pinduoduo';
  }
  if (
    h === 'taobao.com' ||
    h.endsWith('.taobao.com') ||
    h === 'tmall.com' ||
    h.endsWith('.tmall.com') ||
    h === 'tmall.hk' ||
    h.endsWith('.tmall.hk')
  ) {
    return 'taobao';
  }
  if (
    h === 'jd.com' ||
    h.endsWith('.jd.com') ||
    h === 'yiyaojd.com' ||
    h.endsWith('.yiyaojd.com') ||
    h === 'jd.hk' ||
    h.endsWith('.jd.hk')
  ) {
    return 'jd';
  }
  return null;
}

/**
 * Clean Xiaohongshu URL:
 * - Unwrap redirectPath if redirected to login/error page
 * - Rewrite /discovery/item/{id} -> /explore/{id}
 * - Keep only xsec_token and xsec_source
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanXiaohongshuUrl(url) {
  let u = new URL(url.toString());

  const redirectPath = u.searchParams.get('redirectPath');
  if (redirectPath) {
    try {
      const inner = new URL(redirectPath, 'https://www.xiaohongshu.com');
      if (getPlatformKind(inner.hostname) === 'xiaohongshu') {
        u = inner;
      }
    } catch {
      /* ignore invalid redirectPath */
    }
  }

  u.protocol = 'https:';
  u.hostname = 'www.xiaohongshu.com';

  const itemMatch = u.pathname.match(/^\/discovery\/item\/([a-zA-Z0-9_-]+)/i);
  if (itemMatch) {
    u.pathname = `/explore/${itemMatch[1]}`;
  }

  const xsecToken = u.searchParams.get('xsec_token');
  const xsecSource = u.searchParams.get('xsec_source');

  u.search = '';
  if (xsecToken) u.searchParams.set('xsec_token', xsecToken);
  if (xsecSource) u.searchParams.set('xsec_source', xsecSource);
  u.hash = '';

  return u.toString();
}

/**
 * Clean WeChat Official Account article URL:
 * - /s?__biz=...&mid=...&idx=...&sn=... -> keep only __biz, mid, idx, sn
 * - /s/{shortCode}?... -> strip all query parameters
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanWeixinUrl(url) {
  const u = new URL(url.toString());
  u.protocol = 'https:';
  u.hostname = 'mp.weixin.qq.com';
  u.hash = '';

  // Short path format: /s/{shortCode}
  if (/^\/s\/[a-zA-Z0-9_-]+/.test(u.pathname)) {
    u.search = '';
    return u.toString();
  }

  // Query format: /s?__biz=...&mid=...&idx=...&sn=...
  if (u.pathname === '/s' || u.pathname === '/s/') {
    u.pathname = '/s';
    const keepKeys = ['__biz', 'mid', 'idx', 'sn'];
    const pairs = [];
    for (const k of keepKeys) {
      const val = u.searchParams.get(k);
      if (val != null && val !== '') {
        // Preserve unescaped '=' in base64 __biz for clean readability
        const encoded =
          k === '__biz'
            ? encodeURIComponent(val).replace(/%3D/gi, '=')
            : encodeURIComponent(val);
        pairs.push(`${k}=${encoded}`);
      }
    }
    if (!pairs.length) return null;
    return `https://mp.weixin.qq.com/s?${pairs.join('&')}`;
  }

  return null;
}

/**
 * Clean Baidu Tieba post URL:
 * - /p/{id}?... -> https://tieba.baidu.com/p/{id}
 * - /f?kz={id} -> https://tieba.baidu.com/p/{id}
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanTiebaUrl(url) {
  const pMatch = url.pathname.match(/\/p\/(\d+)/);
  if (pMatch) {
    return `https://tieba.baidu.com/p/${pMatch[1]}`;
  }
  const kz = url.searchParams.get('kz');
  if (kz && /^\d+$/.test(kz)) {
    return `https://tieba.baidu.com/p/${kz}`;
  }
  return null;
}

/**
 * Clean Weibo URL:
 * - Keep path (e.g. weibo.com/{uid}/{mid}, m.weibo.cn/detail/{id}, m.weibo.cn/status/{id})
 * - Strip all query parameters and hash
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanWeiboUrl(url) {
  const u = new URL(url.toString());
  u.protocol = 'https:';
  if (normalizeHost(u.hostname) === 'weibo.com') {
    u.hostname = 'weibo.com';
  }
  if (!u.pathname || u.pathname === '/') return null;

  u.search = '';
  u.hash = '';
  return u.toString().replace(/\/$/, '');
}

/**
 * Clean Pinduoduo URL:
 * - Keep only goods_id on mobile.yangkeduo.com/goods.html
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanPinduoduoUrl(url) {
  const goodsId = url.searchParams.get('goods_id');
  if (!goodsId) return null;
  return `https://mobile.yangkeduo.com/goods.html?goods_id=${encodeURIComponent(goodsId)}`;
}

/**
 * Clean Taobao / Tmall product URL:
 * - a.m.taobao.com/i{id}.htm -> https://item.taobao.com/item.htm?id={id}
 * - world.taobao.com/item/{id}.htm -> https://item.taobao.com/item.htm?id={id}
 * - item.taobao.com / h5.m.taobao.com / detail.tmall.com -> keep only ?id={id}
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanTaobaoUrl(url) {
  const host = normalizeHost(url.hostname);

  const mobileMatch = url.pathname.match(/^\/i(\d+)\.htm/i);
  if (mobileMatch) {
    return `https://item.taobao.com/item.htm?id=${mobileMatch[1]}`;
  }

  const worldMatch = url.pathname.match(/\/item\/(\d+)\.htm/i);
  if (worldMatch) {
    return `https://item.taobao.com/item.htm?id=${worldMatch[1]}`;
  }

  const id = url.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) return null;

  if (host === 'tmall.hk' || host.endsWith('.tmall.hk')) {
    return `https://detail.tmall.hk/item.htm?id=${id}`;
  }
  if (host === 'tmall.com' || host.endsWith('.tmall.com')) {
    return `https://detail.tmall.com/item.htm?id=${id}`;
  }
  return `https://item.taobao.com/item.htm?id=${id}`;
}

/**
 * Clean JD product URL:
 * - item.jd.com/{id}.html or item.m.jd.com/product/{id}.html -> https://item.jd.com/{id}.html
 * @param {URL} url
 * @returns {string | null}
 */
export function cleanJdUrl(url) {
  const itemMatch =
    url.pathname.match(/^\/(?:product\/|detail\/)?(\d+)\.html/i) ||
    url.pathname.match(/\/(\d+)\.html$/i);
  if (itemMatch) {
    return `https://item.jd.com/${itemMatch[1]}.html`;
  }

  const wareId = url.searchParams.get('wareId') || url.searchParams.get('sku');
  if (wareId && /^\d+$/.test(wareId)) {
    return `https://item.jd.com/${wareId}.html`;
  }

  return null;
}

/**
 * Clean a parsed URL according to its detected platform kind.
 * @param {URL} url
 * @param {string} [kindOverride]
 * @returns {{ kind: string, cleaned: string | null }}
 */
export function cleanPlatformUrl(url, kindOverride) {
  const kind = kindOverride || getPlatformKind(url.hostname);
  if (!kind) return { kind: 'other', cleaned: null };

  switch (kind) {
    case 'xiaohongshu':
      return { kind, cleaned: cleanXiaohongshuUrl(url) };
    case 'weixin':
      return { kind, cleaned: cleanWeixinUrl(url) };
    case 'tieba':
      return { kind, cleaned: cleanTiebaUrl(url) };
    case 'weibo':
      return { kind, cleaned: cleanWeiboUrl(url) };
    case 'pinduoduo':
      return { kind, cleaned: cleanPinduoduoUrl(url) };
    case 'taobao':
      return { kind, cleaned: cleanTaobaoUrl(url) };
    case 'jd':
      return { kind, cleaned: cleanJdUrl(url) };
    default:
      return { kind: 'other', cleaned: null };
  }
}

/**
 * Extract embedded redirect target URL from HTML response bodies
 * (used by m.tb.cn, u.jd.com, t.cn, etc.).
 * @param {string} html
 * @returns {{ type: 'url' | 'jd_hrl', url: string } | null}
 */
export function extractUrlFromHtml(html) {
  if (!html) return null;

  // 1. JD u.jd.com intermediate `var hrl='https://...'`
  const hrlMatch = html.match(/var\s+hrl\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
  if (hrlMatch) {
    return { type: 'jd_hrl', url: hrlMatch[1] };
  }

  // 2. Taobao m.tb.cn `var url = 'https://...'`
  const varUrlMatch = html.match(/var\s+url\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
  if (varUrlMatch) {
    return { type: 'url', url: varUrlMatch[1] };
  }

  // 3. Direct Taobao / Tmall / JD / Xiaohongshu URLs inside script or markup
  const directMatch = html.match(
    /https?:\/\/(?:item\.taobao\.com|detail\.tmall\.com|detail\.tmall\.hk|chaoshi\.detail\.tmall\.com|a\.m\.taobao\.com|h5\.m\.taobao\.com|item\.jd\.com|item\.m\.jd\.com|www\.xiaohongshu\.com)[^'"\s<>\\]+/i,
  );
  if (directMatch) {
    return { type: 'url', url: directMatch[0] };
  }

  // 4. Generic location.href / location.replace / meta refresh
  const locMatch =
    html.match(/location\.(?:href|replace)\s*(?:=|\()\s*['"](https?:\/\/[^'"]+)['"]/i) ||
    html.match(/content=['"]\d+;\s*url=(https?:\/\/[^'"]+)['"]/i);
  if (locMatch) {
    return { type: 'url', url: locMatch[1] };
  }

  return null;
}

/**
 * Resolve a short link (xhslink.com, m.tb.cn, s.click.taobao.com, 3.cn, u.jd.com, t.cn, w.url.cn)
 * and clean the destination URL.
 * @param {string} raw
 * @returns {Promise<{ ok: true, url: string, kind: string } | { ok: false, error: string, kind: string }>}
 */
export async function resolvePlatformShortLink(raw) {
  let current;
  try {
    current = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'invalid url', kind: 'other' };
  }

  const initialKind = getShortLinkKind(current.hostname) || 'other';
  if (initialKind === 'other') {
    return { ok: false, error: 'not a supported short link', kind: 'other' };
  }

  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  try {
    // Walk up to 5 hops (handles 301/302 Chains + HTML JS hops like m.tb.cn / u.jd.com)
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers,
      });

      const loc = res.headers.get('Location') || res.headers.get('location');
      if (loc) {
        const nextUrl = new URL(loc, current);
        if (!getShortLinkKind(nextUrl.hostname)) {
          const { kind, cleaned } = cleanPlatformUrl(nextUrl);
          if (cleaned) {
            return { ok: true, url: cleaned, kind };
          }
          // Destination may still redirect once more or be a cleanable URL
        }
        current = nextUrl;
        continue;
      }

      // If runtime auto-followed redirects
      if (res.url && res.url !== current.toString()) {
        const followed = new URL(res.url);
        const { kind, cleaned } = cleanPlatformUrl(followed);
        if (cleaned) {
          return { ok: true, url: cleaned, kind };
        }
        current = followed;
      }

      // Inspect HTML body for JS redirects (m.tb.cn `var url = ...`, u.jd.com `var hrl = ...`)
      const text = await res.text();
      const extracted = extractUrlFromHtml(text);
      if (extracted) {
        const nextUrl = new URL(extracted.url, current);
        if (extracted.type === 'jd_hrl') {
          current = nextUrl;
          continue;
        }
        const { kind, cleaned } = cleanPlatformUrl(nextUrl);
        if (cleaned) {
          return { ok: true, url: cleaned, kind };
        }
        current = nextUrl;
        continue;
      }

      break;
    }

    // Final attempt to clean whatever URL we landed on
    const { kind, cleaned } = cleanPlatformUrl(current);
    if (cleaned) {
      return { ok: true, url: cleaned, kind };
    }

    return { ok: false, error: 'unable to resolve clean destination', kind: initialKind };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), kind: initialKind };
  }
}
