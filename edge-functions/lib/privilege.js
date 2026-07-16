/**
 * Privilege list: bootstrap env IDs + EdgeOne KV namespace.
 *
 * Bind a KV namespace to this project with variable name `PRIV_KV`
 * (or pass any object with get/put/delete/list).
 */

const KEY_PREFIX = 'user_';

/**
 * @param {number | string | undefined | null} tgId
 * @param {{ bootstrapPrivilegedIds: number[] }} config
 * @param {{ get: Function, put: Function, delete: Function, list: Function } | null | undefined} kv
 */
export async function isPrivileged(tgId, config, kv) {
  if (tgId == null) return false;
  const id = Number(tgId);
  if (!Number.isFinite(id)) return false;

  if (config.bootstrapPrivilegedIds?.includes(id)) return true;
  if (!kv) return false;

  try {
    const v = await kv.get(KEY_PREFIX + id);
    return v != null && v !== '';
  } catch (e) {
    console.error('privilege kv get failed', e);
    return false;
  }
}

/**
 * @param {number} tgId
 * @param {string} [note]
 * @param {object} kv
 */
export async function grantPrivilege(tgId, note, kv) {
  if (!kv) throw new Error('KV is not bound (PRIV_KV)');
  const payload = JSON.stringify({
    note: note || null,
    at: Date.now(),
  });
  await kv.put(KEY_PREFIX + tgId, payload);
}

/**
 * @param {number} tgId
 * @param {object} kv
 */
export async function revokePrivilege(tgId, kv) {
  if (!kv) throw new Error('KV is not bound (PRIV_KV)');
  await kv.delete(KEY_PREFIX + tgId);
}

/**
 * @param {object} kv
 * @returns {Promise<{ tgId: number, note: string | null }[]>}
 */
export async function listPrivileged(kv) {
  if (!kv) return [];
  const rows = [];
  let cursor;
  do {
    const result = await kv.list({
      prefix: KEY_PREFIX,
      limit: 256,
      ...(cursor ? { cursor } : {}),
    });
    for (const item of result.keys || []) {
      const key = item.key || item;
      const idStr = String(key).slice(KEY_PREFIX.length);
      const tgId = Number(idStr);
      if (!Number.isFinite(tgId)) continue;
      let note = null;
      try {
        const raw = await kv.get(String(key));
        if (raw) {
          try {
            note = JSON.parse(raw).note || null;
          } catch {
            note = raw;
          }
        }
      } catch {
        /* ignore */
      }
      rows.push({ tgId, note });
    }
    cursor = result.complete ? null : result.cursor;
    if (result.complete) break;
  } while (cursor);
  return rows;
}
