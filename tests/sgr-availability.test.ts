import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  checkAvailability,
  destinationsFor,
  formatDate,
  isValidDate,
  stations,
} from '../src/lib/sgr/provider'
import { AvailabilityParseError, parseAvailabilityHtml, parseStationOptions } from '../src/lib/sgr/parser'
import { fetchAvailability } from '../src/lib/sgr/client'
import { createHistoricalFixtureProvider } from '../src/lib/sgr/adapters'

const historicalResult = readFileSync(fileURLToPath(new URL('./fixtures/sgr-availability-historical.html', import.meta.url)), 'utf8')
const historicalStations = readFileSync(fileURLToPath(new URL('./fixtures/sgr-stations-historical.html', import.meta.url)), 'utf8')
const historicalDestinations = readFileSync(fileURLToPath(new URL('./fixtures/sgr-destinations-nairobi-historical.html', import.meta.url)), 'utf8')

describe('SGR availability provider boundary', () => {
  it('exposes the existing SafariRail terminus routes', () => {
    expect(stations.map(({ name }) => name)).toEqual(['Nairobi Terminus', 'Mombasa Terminus'])
    expect(destinationsFor('nairobi-terminus')).toEqual([stations[1]])
    expect(destinationsFor('unknown')).toEqual([])
  })

  it('validates and formats real calendar dates', () => {
    expect(isValidDate('2026-11-28')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('28-11-2026')).toBe(false)
    expect(formatDate('2026-11-28')).toContain('Saturday')
  })

  it('reports unavailable instead of inventing seat counts or sold-out status', async () => {
    const result = await checkAvailability('nairobi-terminus', 'mombasa-terminus', '2026-11-28')
    expect(result).toMatchObject({
      date: '2026-11-28',
      status: 'unavailable',
      lastChecked: null,
      trains: [],
    })
  })

  it('rejects invalid routes and dates', async () => {
    await expect(checkAvailability('nairobi-terminus', 'nairobi-terminus', '2026-11-28')).rejects.toThrow()
    await expect(checkAvailability('unknown', 'mombasa-terminus', '2026-11-28')).rejects.toThrow()
    await expect(checkAvailability('nairobi-terminus', 'mombasa-terminus', '2026-02-30')).rejects.toThrow()
  })

  it('parses the captured terminal options and maps Nairobi destinations', () => {
    const capturedStations = parseStationOptions(historicalStations)
    expect(capturedStations).toHaveLength(9)
    expect(capturedStations[0]).toEqual({ id: '2', name: 'Nairobi Terminus' })
    expect(capturedStations.find((station) => station.id === '4')?.name).toBe('Voi')
    expect(capturedStations.some((station) => station.name === 'Select...')).toBe(false)

    expect(parseStationOptions(historicalDestinations)).toEqual([
      { id: '3', name: 'Mombasa Terminus' },
      { id: '4', name: 'Voi' },
      { id: '5', name: 'Mtito Andei' },
      { id: '10', name: 'Emali' },
      { id: '9', name: 'Kibwezi' },
      { id: '7', name: 'Miaseny' },
      { id: '6', name: 'Mariakani' },
    ])
  })

  it('parses historical train identity, route, timestamps, seats and adult fares', () => {
    expect(parseAvailabilityHtml(historicalResult)).toEqual([{
      trainId: '36218',
      trainNumber: 'N2',
      origin: 'Nairobi Terminus',
      destination: 'Mombasa Terminus',
      departure: '08:00',
      arrival: '14:00',
      date: '2026-11-28',
      economyAvailable: 523,
      firstClassAvailable: 36,
      economyFare: 1500,
      firstClassFare: 4500,
    }])
  })

  it('provides an explicit historical mock that cannot be mistaken for live inventory', async () => {
    const historical = await createHistoricalFixtureProvider(
      historicalResult,
      '2026-11-14T22:10:26.630Z',
    ).check({
      origin: 'nairobi-terminus',
      destination: 'mombasa-terminus',
      date: '2026-11-28',
    })
    expect(historical).toMatchObject({
      status: 'available',
      lastChecked: '2026-11-14T22:10:26.630Z',
      source: 'historical-fixture',
      isLive: false,
      trains: [{ trainNumber: 'N2', economyAvailable: 523, firstClassAvailable: 36 }],
    })
    expect(historical.message).toMatch(/not current availability/)
    const absent = await createHistoricalFixtureProvider(historicalResult, '2026-11-14T22:10:26Z')
      .check({ origin: 'nairobi-terminus', destination: 'mombasa-terminus', date: '2026-11-29' })
    expect(absent).toMatchObject({ status: 'unavailable', lastChecked: null, isLive: false, trains: [] })
  })

  it('returns an empty list for a valid results document with no train cards', () => {
    expect(parseAvailabilityHtml('<html><body><p>No results.</p></body></html>')).toEqual([])
  })

  it('rejects non-HTML, challenge, expired-session, and CSRF error responses', () => {
    expect(() => parseAvailabilityHtml('upstream unavailable')).toThrow(AvailabilityParseError)
    expect(() => parseAvailabilityHtml('<html><title>Just a moment...</title></html>')).toThrow(/challenge/)
    expect(() => parseAvailabilityHtml('<html>Session has expired</html>')).toThrow(/expired session/)
    expect(() => parseAvailabilityHtml('<html>Invalid CSRF token</html>')).toThrow(/CSRF/)
  })

  it('does not treat the captured empty redirect as sold out', () => {
    // The HAR's 26 November POST redirected with an empty response. Our parser
    // has no HTML from that response, so a caller must report unavailable.
    expect(() => parseAvailabilityHtml('')).toThrow(AvailabilityParseError)
  })

  it('validates destination/date in the request and reports fetch/network errors', async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('date=2026-11-28')
      return Response.json({ status: 'unavailable' }, { status: 503 })
    }
    const response = await fetchAvailability('nairobi-terminus', 'mombasa-terminus', '2026-11-28', fetcher)
    expect(response).toMatchObject({ ok: false, data: { status: 'unavailable' } })

    await expect(fetchAvailability(
      'nairobi-terminus',
      'mombasa-terminus',
      '2026-11-28',
      async () => { throw new TypeError('Network error') },
    )).rejects.toThrow('Network error')
  })

  it('aborts a request that exceeds its timeout', async () => {
    const fetcher = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })
    await expect(fetchAvailability('nairobi-terminus', 'mombasa-terminus', '2026-11-28', fetcher, 5))
      .rejects.toMatchObject({ name: 'TimeoutError' })
  })
})
