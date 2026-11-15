import { checkLiveAvailability, PortalError } from './live'
import type { AvailabilityResult } from './provider'
import type { RouteQuery } from './calendar'

// Cloudflare's shared edge cache is bounded by TTL. A small in-memory fallback
// supports local development; no portal cookies or CSRF tokens are cached.
const memory = new Map<string, { result: AvailabilityResult; expires: number }>()
const pending = new Map<string, Promise<AvailabilityResult>>()
const limits = new Map<string, { count: number; reset: number }>()
let active = 0
const waiting: Array<() => void> = []
const ttl = 120
function key(query: RouteQuery, date: string) {
  return `${query.service}/${query.origin}/${query.destination}/${query.departure || 'any'}/${date}`
}
function edge(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default
}
function cacheRequest(id: string) { return new Request(`https://www.safarirail.co.ke/__availability-cache/v2/${id}`) }
export function limited(request: Request, bucket: string, maximum: number): boolean {
  const id = `${bucket}:${request.headers.get('CF-Connecting-IP') || 'local'}`
  const now = Date.now()
  let entry = limits.get(id)
  if (!entry || entry.reset <= now) { entry = { count: 0, reset: now + 60_000 }; limits.set(id, entry) }
  if (limits.size > 4096) for (const [k, v] of limits) { if (v.reset <= now) limits.delete(k) }
  if (limits.size > 8192) limits.delete(limits.keys().next().value!)
  return ++entry.count > maximum
}
export async function cachedResult(query: RouteQuery, date: string): Promise<AvailabilityResult | undefined> {
  const id = key(query, date)
  const local = memory.get(id)
  if (local && local.expires > Date.now()) return local.result
  memory.delete(id)
  try {
    const response = await edge()?.match(cacheRequest(id))
    if (response) return await response.json() as AvailabilityResult
  } catch { /* Cache failures must not prevent a live check. */ }
}
async function save(query: RouteQuery, result: AvailabilityResult) {
  const id = key(query, result.date)
  const duration = result.status === 'unavailable' ? 30 : ttl
  memory.set(id, { result, expires: Date.now() + duration * 1000 })
  if (memory.size > 1024) memory.delete(memory.keys().next().value!)
  try { await edge()?.put(cacheRequest(id), Response.json(result, { headers: { 'Cache-Control': `public, max-age=${duration}` } })) } catch { /* Optional cache. */ }
}
export async function checkedResult(query: RouteQuery, date: string, refresh = false): Promise<AvailabilityResult> {
  const id = key(query, date)
  if (pending.has(id)) return pending.get(id)!
  if (!refresh) { const cached = await cachedResult(query, date); if (cached) return cached }
  if (pending.has(id)) return pending.get(id)!
  if (active >= 4 && waiting.length >= 12) return { date, status: 'unavailable', lastChecked: null, source: 'none', isLive: false,
    message: 'The checker is busy. Please try again shortly.', trains: [] }
  const task = (async () => {
    // A service change can overlap a few finishing checks. Queue that work
    // instead of immediately returning an unknown result for the new service.
    if (active >= 4) await new Promise<void>(resolve => waiting.push(resolve))
    else active++
    try {
      const result = await checkLiveAvailability(query.origin, query.destination, date, fetch, query.service, query.departure)
      await save(query, result)
      return result
    } catch (error) {
      const stage = error instanceof PortalError ? error.stage : 'unknown'
      const code = error instanceof PortalError ? error.code : 'unexpected'
      console.error('[sgr] availability provider failure', { stage, code })
      const result: AvailabilityResult = { date, status: 'unavailable', lastChecked: null, source: 'none', isLive: false,
        message: 'Kenya Railways could not confirm seats just now. Please retry or check the official portal.', trains: [] }
      await save(query, result)
      return result
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
      pending.delete(id)
    }
  })()
  pending.set(id, task)
  return task
}
