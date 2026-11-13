// Client for one of serve.py's JSON file stores (see serve.py): list, load, save, remove by name.
// `url` is the store's URL, e.g. 'api/saves' (relative to the page) or '/api/content'.

export function fileStore(url) {
  const at = name => `${url}/${encodeURIComponent(name)}`;
  const check = async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Server answered ${r.status}`);
    return r;
  };
  return {
    /** [{ name, savedAt }], newest first; names starting with "_" are left out. */
    list: async () => (await check(await fetch(url, { cache: 'no-store' }))).json(),
    load: async name => (await check(await fetch(at(name), { cache: 'no-store' }))).json(),
    save: async (name, data, { keepalive = false } = {}) => check(await fetch(at(name), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data, null, 2), keepalive,
    })),
    remove: async name => check(await fetch(at(name), { method: 'DELETE' })),
  };
}
