import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('../src/lib/sgr/live', async original => ({ ...await original<Record<string, unknown>>(), checkLiveAvailability: vi.fn() }))
import { checkLiveAvailability } from '../src/lib/sgr/live'
const route = { origin: '2', destination: '3', service: 'express' as const, departure: '3.00' }
const result = { date: '2026-11-28', status: 'sold-out' as const, lastChecked: '2026-11-15T10:00:00Z', source: 'live' as const, isLive: true, trains: [] }
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('availability cache', () => {
  it('coalesces concurrent requests for one date and reuses the result', async () => {
    vi.mocked(checkLiveAvailability).mockResolvedValue(result)
    const { checkedResult } = await import('../src/lib/sgr/cache')
    await Promise.all([checkedResult(route, result.date), checkedResult(route, result.date)])
    await checkedResult(route, result.date)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(1)
  })
  it('isolates departure and service cache keys', async () => {
    vi.mocked(checkLiveAvailability).mockResolvedValue(result)
    const { checkedResult } = await import('../src/lib/sgr/cache')
    await checkedResult(route, result.date)
    await checkedResult({ ...route, departure: '10.00' }, result.date)
    await checkedResult({ ...route, service: 'inter_county' }, result.date)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(3)
  })
  it('expires successful results after two minutes and permits a manual refresh', async () => {
    vi.mocked(checkLiveAvailability).mockResolvedValue(result)
    const { checkedResult } = await import('../src/lib/sgr/cache')
    await checkedResult(route, result.date)
    vi.setSystemTime(Date.now() + 121_000)
    await checkedResult(route, result.date)
    await checkedResult(route, result.date, true)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(3)
  })
  it('caches provider failures briefly without inventing inventory', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(checkLiveAvailability).mockRejectedValue(new Error('private provider details'))
    const { checkedResult } = await import('../src/lib/sgr/cache')
    const value = await checkedResult(route, result.date)
    expect(value).toMatchObject({ status: 'unavailable', lastChecked: null, trains: [] })
    expect(JSON.stringify(value)).not.toContain('private')
    await checkedResult(route, result.date)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 31_000)
    await checkedResult(route, result.date)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(2)
  })
  it('queues overlapping service checks instead of returning unknown when four are active', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.mocked(checkLiveAvailability).mockImplementation(async () => { await gate; return result })
    const { checkedResult } = await import('../src/lib/sgr/cache')
    const checks = Array.from({ length: 5 }, (_, i) => checkedResult(route, '2026-11-' + (20 + i)))
    await vi.waitFor(() => expect(checkLiveAvailability).toHaveBeenCalledTimes(4))
    release()
    const results = await Promise.all(checks)
    expect(checkLiveAvailability).toHaveBeenCalledTimes(5)
    expect(results.every(value => value.status === 'sold-out')).toBe(true)
  })

})
