/**
 * Expand b23.tv (and kin) short links → clean bilibili.com URLs.
 *
 * Approach (same idea as b23.tv-tools / b23.wtf, no reverse shortener):
 * 1. HTTP request short URL, follow / read redirect
 * 2. Strip tracking query params; keep useful ones (p, t, …)
 *
 * Refs:
 * - https://github.com/SunsetMkt/b23.tv-tools (HEAD + strip query)
 * - https://github.com/nicholascw/b23.wtf
 */

/** Hosts that only redirect / wrap Bilibili destinations. */
const SHORT_HOSTS = new Set([
  'b23.tv',
  'b23.wtf', // privacy frontends also resolve short paths
  'bili2233.cn',
  'bili2233.com',
]);

const BILI_HOST_RE = /(^|\.)bilibili\.com$/i;

/** Query keys that are safe / useful to keep on bilibili URLs. */
const KEEP_QUERY = new Set([
  'p', // multi-part episode
  't', // start time (seconds)
  'start_progress',
  'tab',
  'topic_id',
  'type',
  'oid',
  'cid',
]);

/**
 * @param {string} hostname
 */
export function isB23Host(hostname) {
  const h = hostname.replace(/^www\./i, '').toLowerCase();
  return SHORT_HOSTS.has(h);
}

/**
 * @param {string} hostname
 */
export function isBilibiliHost(hostname) {
  const h = hostname.replace(/^www\./i, '').toLowerCase();
  return BILI_HOST_RE.test(h) || h === 'bilibili.tv' || h.endsWith('.bilibili.tv');
}

/**
 * Remove tracking parameters; keep playback-related ones.
 * @param {string | URL} input
 * @returns {string}
 */
export function cleanBilibiliUrl(input) {
  const u = typeof input === 'string' ? new URL(input) : new URL(input.toString());

  // Prefer https + www for main site consistency when host is bilibili.com
  if (/^(www\.)?bilibili\.com$/i.test(u.hostname)) {
    u.protocol = 'https:';
    u.hostname = 'www.bilibili.com';
  }

  for (const key of [...u.searchParams.keys()]) {
    if (KEEP_QUERY.has(key)) continue;
    // Drop everything else (spm_*, utm_*, vd_source, share_*, …)
    u.searchParams.delete(key);
  }

  u.hash = '';
  // Normalize trailing noise
  let out = u.toString();
  // Avoid empty `?`
  out = out.replace(/\?$/, '');
  return out;
}

/**
 * Whether a bilibili.com URL still has trackers worth stripping (sync path).
 * @param {string} raw
 */
export function bilibiliNeedsClean(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!isBilibiliHost(u.hostname)) return false;
    for (const key of u.searchParams.keys()) {
      if (!KEEP_QUERY.has(key)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a b23.tv (etc.) short link to a cleaned bilibili URL.
 * @param {string} raw
 * @returns {Promise<{ ok: true, url: string } | { ok: false, error: string }>}
 */
export async function resolveB23(raw) {
  let start;
  try {
    start = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'invalid url' };
  }

  if (!isB23Host(start.hostname)) {
    return { ok: false, error: 'not a b23 short link' };
  }

  // Prefer manual redirect read (one hop is enough for b23.tv → bilibili)
  try {
    const res = await fetch(start.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        // Desktop UA; some CDNs are picky about empty UA
        'User-Agent':
          'Mozilla/5.0 (compatible; LinkFixerBot/1.0; +https://t.me/) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });

    const loc = res.headers.get('Location') || res.headers.get('location');
    if (loc) {
      const dest = new URL(loc, start);
      return { ok: true, url: cleanBilibiliUrl(dest) };
    }

    // Some runtimes auto-follow anyway and expose final URL
    if (res.url && res.url !== start.toString() && !isB23Host(new URL(res.url).hostname)) {
      return { ok: true, url: cleanBilibiliUrl(res.url) };
    }
  } catch (e) {
    console.warn('b23 manual resolve failed', e?.message || e);
  }

  // Fallback: follow redirects
  try {
    const res = await fetch(start.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LinkFixerBot/1.0; +https://t.me/) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    const finalUrl = res.url || start.toString();
    if (isB23Host(new URL(finalUrl).hostname)) {
      return { ok: false, error: 'short link did not redirect' };
    }
    return { ok: true, url: cleanBilibiliUrl(finalUrl) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
