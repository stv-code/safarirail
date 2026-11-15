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
import {
  checkLiveAvailability,
  getLiveDestinations,
  getLiveDirectory,
  parseBookingWindow,
  PortalError,
} from '../src/lib/sgr/live'

const historicalResult = readFileSync(fileURLToPath(new URL('./fixtures/sgr-availability-historical.html', import.meta.url)), 'utf8')
const historicalStations = readFileSync(fileURLToPath(new URL('./fixtures/sgr-stations-historical.html', import.meta.url)), 'utf8')
const historicalDestinations = readFileSync(fileURLToPath(new URL('./fixtures/sgr-destinations-nairobi-historical.html', import.meta.url)), 'utf8')

function travelDateAfter(days: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((value) => value.type === type)?.value || ''
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function makePortalFetcher(options: {
  resultHtml?: string
  redirectSearch?: boolean
  challengePage?: boolean
  turnstileWidget?: boolean
  csrfRejected?: boolean
} = {}) {
  const calls: Array<{ path: string; method: string; cookie: string | null; body: string }> = []
  let pageNumber = 0
  let freshToken = ''
  const date = travelDateAfter(7)
  const resultHtml = (options.resultHtml || historicalResult)
    .replaceAll('2026-11-28', date)
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    const body = typeof init?.body === 'string' ? init.body : ''
    calls.push({ path: url.pathname + url.search, method: init?.method || 'GET', cookie: headers.get('Cookie'), body })
    if (url.pathname === '/index.php') {
      pageNumber += 1
      freshToken = `fresh-token-${pageNumber}`
      const responseHtml = options.challengePage
        ? '<html><title>Just a moment...</title></html>'
        : `<html><form action="search-view-results.php" method="post"><input name="csrf_token" value="${freshToken}"></form>${options.turnstileWidget ? '<div class="cf-turnstile" data-sitekey="test"></div>' : ''}<script>$('.datepicker').datepicker({ minDate: -0, maxDate: "+60D" });</script></html>`
      return new Response(responseHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
          'Set-Cookie': `PORTALSESSION=session-${pageNumber}; Path=/; Secure; HttpOnly`,
        },
      })
    }
    if (url.pathname === '/fetch.php' && url.searchParams.get('type') === 'terminals') {
      return new Response(historicalStations, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    }
    if (url.pathname === '/fetch.php' && url.searchParams.get('type') === 'destinations') {
      const origin = url.searchParams.get('terminal_id')
      const optionsHtml = origin === '2'
        ? historicalDestinations
        : historicalStations.replace(/<option value='3'>Mombasa Terminus<\/option>/, '')
      return new Response(optionsHtml, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    }
    if (url.pathname === '/search-view-results.php') {
      const submitted = new URLSearchParams(body)
      if (options.redirectSearch) return new Response(null, { status: 302, headers: { Location: '/index.php' } })
      if (options.csrfRejected) return new Response('<html>Invalid CSRF token</html>', { headers: { 'Content-Type': 'text/html' } })
      if (submitted.get('csrf_token') !== freshToken) return new Response('Invalid CSRF token', { status: 200 })
      if (headers.get('Cookie') !== `PORTALSESSION=session-${pageNumber}`) {
        return new Response('Session mismatch', { status: 400 })
      }
      return new Response(resultHtml, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } })
    }
    throw new Error('Unexpected portal request')
  }
  return { fetcher, calls, date }
}

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

  it('discovers the live portal date window and uses dynamic terminal/destination lists', async () => {
    const now = new Date('2026-11-15T10:00:00Z')
    const window = parseBookingWindow(
      '<script>datepicker({ minDate: -0, maxDate: "+60D" });</script>',
      now,
    )
    expect(window).toMatchObject({ earliest: '2026-11-15', latest: '2027-01-14' })

    const portal = makePortalFetcher()
    const directory = await getLiveDirectory(portal.fetcher)
    expect(directory.stations).toHaveLength(9)
    expect(directory.stations.find((station) => station.name === 'Nairobi Terminus')?.id).toBe('2')
    expect(directory.window.latest).toBeTruthy()

    const destinations = await getLiveDestinations('2', portal.fetcher)
    expect(destinations).toContainEqual({ id: '3', name: 'Mombasa Terminus' })
    const reverse = await getLiveDestinations('3', portal.fetcher)
    expect(reverse).toContainEqual({ id: '2', name: 'Nairobi Terminus' })
    expect(portal.calls.every((call) => call.method === 'GET' || call.method === 'POST')).toBe(true)
    expect(portal.calls.filter((call) => call.path.startsWith('/fetch.php')).every((call) => call.cookie === null)).toBe(true)
  })

  it('uses fresh page tokens and maintains portal cookies for a live read-only search', async () => {
    const portal = makePortalFetcher()
    const result = await checkLiveAvailability('2', '3', portal.date, portal.fetcher)
    expect(result).toMatchObject({
      status: 'available',
      source: 'live',
      isLive: true,
      trains: [{
        trainNumber: 'N2',
        departure: '08:00',
        arrival: '14:00',
        economyAvailable: 523,
        firstClassAvailable: 36,
        economyFare: 1500,
        firstClassFare: 4500,
      }],
    })
    const post = portal.calls.find((call) => call.method === 'POST')
    expect(post?.cookie).toBe('PORTALSESSION=session-1')
    expect(new URLSearchParams(post?.body).get('csrf_token')).toBe('fresh-token-1')
    expect(new URLSearchParams(post?.body).get('travel-date')).toBe(
      `${portal.date.slice(5, 7)}/${portal.date.slice(8, 10)}/${portal.date.slice(0, 4)}`,
    )
  })

  it('marks dates beyond the portal window outside-window without searching', async () => {
    const portal = makePortalFetcher()
    const result = await checkLiveAvailability('2', '3', '2099-01-01', portal.fetcher)
    expect(result.status).toBe('outside-window')
    expect(portal.calls.some((call) => call.path.startsWith('/search-view-results.php'))).toBe(false)
  })

  it('treats empty results and redirects as unavailable, never sold out', async () => {
    const empty = makePortalFetcher({ resultHtml: '<html><body>No train result cards.</body></html>' })
    const emptyResult = await checkLiveAvailability('2', '3', empty.date, empty.fetcher)
    expect(emptyResult).toMatchObject({ status: 'unavailable', lastChecked: null, trains: [] })

    const redirected = makePortalFetcher({ redirectSearch: true })
    await expect(checkLiveAvailability('2', '3', redirected.date, redirected.fetcher))
      .rejects.toMatchObject({ name: 'PortalError', code: 'redirected_search' })
  })

  it('does not retry a rejected token and fetches a fresh token on the next manual check', async () => {
    const rejected = makePortalFetcher({ csrfRejected: true })
    await expect(checkLiveAvailability('2', '3', rejected.date, rejected.fetcher))
      .rejects.toMatchObject({ name: 'PortalError', code: 'csrf_rejected' })
    expect(rejected.calls.filter((call) => call.method === 'POST')).toHaveLength(1)

    const refreshed = makePortalFetcher()
    const first = await checkLiveAvailability('2', '3', refreshed.date, refreshed.fetcher)
    const second = await checkLiveAvailability('2', '3', refreshed.date, refreshed.fetcher)
    expect(first.status).toBe('available')
    expect(second.status).toBe('available')
    const tokens = refreshed.calls
      .filter((call) => call.method === 'POST')
      .map((call) => new URLSearchParams(call.body).get('csrf_token'))
    expect(tokens).toEqual(['fresh-token-1', 'fresh-token-2'])
  })

  it('refuses a Turnstile challenge and does not submit a search', async () => {
    const challenge = makePortalFetcher({ challengePage: true })
    await expect(checkLiveAvailability('2', '3', challenge.date, challenge.fetcher))
      .rejects.toMatchObject({ name: 'PortalError', code: 'challenge_required' })
    expect(challenge.calls.some((call) => call.method === 'POST')).toBe(false)
    const widget = makePortalFetcher({ turnstileWidget: true })
    await expect(checkLiveAvailability('2', '3', widget.date, widget.fetcher))
      .rejects.toMatchObject({ name: 'PortalError', code: 'challenge_required' })
    expect(widget.calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('confirms sold-out only when a successful result has zero seats in both classes', async () => {
    const soldOutHtml = historicalResult
      .replace('value="523"', 'value="0"')
      .replace('value="36"', 'value="0"')
    const portal = makePortalFetcher({ resultHtml: soldOutHtml })
    const result = await checkLiveAvailability('2', '3', portal.date, portal.fetcher)
    expect(result).toMatchObject({ status: 'sold-out', lastChecked: expect.any(String) })
  })

  it('reports upstream timeouts and never falls back to historical data', async () => {
    const timeoutFetcher: typeof fetch = async () => { throw new TypeError('network timeout') }
    await expect(checkLiveAvailability('2', '3', travelDateAfter(7), timeoutFetcher))
      .rejects.toMatchObject({ name: 'PortalError', code: 'network_or_timeout' })
    expect(PortalError).toBeDefined()
  })
})
