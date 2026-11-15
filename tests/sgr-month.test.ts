import { describe, it, expect, vi, beforeEach } from 'vitest'
import { monthDates, nairobiToday, routeQuery } from '../src/lib/sgr/calendar'
import { onRequest } from '../functions/api/sgr/month'
import * as cache from '../src/lib/sgr/cache'
import * as live from '../src/lib/sgr/live'
vi.mock('../src/lib/sgr/cache', () => ({ limited: vi.fn(() => false), cachedResult: vi.fn(), checkedResult: vi.fn() }))
vi.mock('../src/lib/sgr/live', async (original) => ({ ...await original<typeof live>(), getLiveDirectory: vi.fn() }))
const date = nairobiToday()
const month = date.slice(0, 7)
const makeRequest = (query = '') => new Request(`https://www.safarirail.co.ke/api/sgr/month?origin=2&destination=3&month=${month}${query}`)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cache.limited).mockReturnValue(false)
  vi.mocked(cache.cachedResult).mockResolvedValue(undefined)
  vi.mocked(live.getLiveDirectory).mockResolvedValue({ stations: [{ id: '2', name: 'Nairobi Terminus' }, { id: '3', name: 'Mombasa Terminus' }], window: { earliest: date, latest: monthDates(month).at(-1)!, discoveredAt: new Date().toISOString() } })
  vi.mocked(cache.checkedResult).mockImplementation(async (_query, day) => ({ date: day, status: 'sold-out', lastChecked: new Date().toISOString(), source: 'live', isLive: true, trains: [] }))
})
describe('monthly availability', () => {
  it('uses Nairobi dates even across UTC midnight', () => {
    expect(nairobiToday(new Date('2026-11-14T22:00:00Z'))).toBe('2026-11-15')
  })
  it('validates calendar boundaries and route/service combinations', () => {
    expect(monthDates('2028-02')).toHaveLength(29)
    expect(() => monthDates('2026-13')).toThrow()
    expect(() => routeQuery(new URL('https://test/?origin=2&destination=2'))).toThrow()
    expect(() => routeQuery(new URL('https://test/?origin=2&destination=3&service=invalid'))).toThrow()
    expect(() => routeQuery(new URL('https://test/?origin=2&destination=3&service=express&departure=bogus'))).toThrow()
  })
  it('checks at most three dates and prioritizes the selected date', async () => {
    const last = monthDates(month).at(-1)!
    const response = await onRequest({ request: makeRequest(`&selected=${last}`) })
    expect(response.status).toBe(200)
    expect(cache.checkedResult).toHaveBeenCalledTimes(Math.min(3, monthDates(month).filter(day => day >= date).length))
    expect(vi.mocked(cache.checkedResult).mock.calls[0][1]).toBe(last)
    const result = await response.json()
    expect(result.days.find((day: { date: string }) => day.date === last).status).toBe('sold-out')
  })
  it('does not contact the provider for cached dates', async () => {
    vi.mocked(cache.cachedResult).mockImplementation(async (_query, day) => ({ date: day, status: 'sold-out', lastChecked: new Date().toISOString(), source: 'live', isLive: true, trains: [] }))
    const result = await (await onRequest({ request: makeRequest() })).json()
    expect(cache.checkedResult).not.toHaveBeenCalled()
    expect(result.loading).toBe(false)
    expect(result.incomplete).toBe(false)
  })
  it('stops scanning on provider failure without marking unknown days sold out', async () => {
    vi.mocked(cache.checkedResult).mockImplementation(async (_query, day) => ({ date: day, status: 'unavailable', lastChecked: null, source: 'none', isLive: false, trains: [] }))
    const result = await (await onRequest({ request: makeRequest() })).json()
    expect(result.loading).toBe(false)
    expect(result.incomplete).toBe(true)
    expect(result.days.some((day: { status: string }) => day.status === 'sold-out')).toBe(false)
  })
  it('rejects invalid months before fetching upstream and applies rate limits', async () => {
    expect((await onRequest({ request: new Request('https://test/?origin=2&destination=3&month=bad') })).status).toBe(400)
    expect(live.getLiveDirectory).not.toHaveBeenCalled()
    vi.mocked(cache.limited).mockReturnValue(true)
    const response = await onRequest({ request: makeRequest() })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  })
  it('streams a snapshot before a slow date finishes and emits fast dates independently', async () => {
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    vi.mocked(cache.checkedResult).mockImplementation(async (_query, day) => {
      if (day === date) await blocked
      return { date: day, status: 'available', lastChecked: new Date().toISOString(), source: 'live', isLive: true,
        trains: [{ trainNumber: 'N2', departure: '08:00', arrival: '14:00', economyAvailable: 123, firstClassAvailable: 7, economyFare: 1500, firstClassFare: 4500 }] }
    })
    const response = await onRequest({ request: makeRequest('&stream=1&selected=' + date) })
    expect(response.headers.get('content-type')).toContain('application/x-ndjson')
    const reader = response.body!.getReader()
    const first = new TextDecoder().decode((await reader.read()).value)
    expect(JSON.parse(first).type).toBe('snapshot')
    const second = JSON.parse(new TextDecoder().decode((await reader.read()).value))
    expect(second.type).toBe('day')
    expect(second.day.date).not.toBe(date)
    expect(second.day.economy).toBe(123)
    expect(second.day.firstClass).toBe(7)
    release()
    let content = ''
    while (true) { const { done, value } = await reader.read(); if (done) break; content += new TextDecoder().decode(value) }
    expect(content).toContain('"type":"done"')
    expect(content).toContain('"date":"' + date + '"')
  })

  it('returns cached class counts and train details without another seat search', async () => {
    vi.mocked(cache.cachedResult).mockImplementation(async (_query, day) => ({ date: day, status: 'available', lastChecked: new Date().toISOString(), source: 'live', isLive: true,
      trains: [{ trainNumber: 'N2', departure: '08:00', arrival: '14:00', economyAvailable: 123, firstClassAvailable: 7, economyFare: 1500, firstClassFare: 4500 }] }))
    const response = await onRequest({ request: makeRequest('&stream=1') })
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
    expect(events[0].days.find((day: { date: string }) => day.date === date)).toMatchObject({ economy: 123, firstClass: 7, seats: 130, trains: [{ trainNumber: 'N2' }] })
    expect(cache.checkedResult).not.toHaveBeenCalled()
    expect(events.at(-1).incomplete).toBe(false)
  })

})
