/** Cache only public, non-session directory data across Cloudflare isolates. */
const memory = new Map<string, { value: unknown; expires: number }>()
const pending = new Map<string, Promise<unknown>>()
export async function publicDirectory<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = memory.get(key)
  if (cached && cached.expires > Date.now()) return cached.value as T
  const running = pending.get(key)
  if (running) return running as Promise<T>
  const task = (async () => {
    const edge = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
    const request = new Request(`https://www.safarirail.co.ke/__directory/v1/${key}`)
    try { const hit = await edge?.match(request); if (hit) { const value = await hit.json() as T; memory.set(key, { value, expires: Date.now() + 60_000 }); return value } } catch { /* Cache is optional. */ }
    const value = await load()
    memory.set(key, { value, expires: Date.now() + 300_000 })
    if (memory.size > 100) memory.delete(memory.keys().next().value!)
    try { await edge?.put(request, Response.json(value, { headers: { 'Cache-Control': 'public, max-age=300' } })) } catch { /* Cache is optional. */ }
    return value
  })()
  pending.set(key, task)
  try { return await task } finally { pending.delete(key) }
}
