import {
  AvailabilityParseError,
  parseAvailabilityHtml,
  parseStationOptions,
  type ParsedTrain,
} from './parser'
import { isValidDate, type AvailabilityResult, type SgrStation } from './provider'

const PORTAL = 'https://metickets.krc.co.ke'
const SCHEDULE_TYPE = 'inter_county'
const REQUEST_TIMEOUT_MS = 9_000
const DIRECTORY_TTL_MS = 5 * 60_000

export type BookingWindow = {
  earliest: string | null
  latest: string | null
  discoveredAt: string
}

export class PortalError extends Error {
  constructor(readonly stage: 'page' | 'stations' | 'destinations' | 'search', readonly code: string) {
    super('Official availability source request failed')
    this.name = 'PortalError'
  }
}

function getSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof extended.getSetCookie === 'function') return extended.getSetCookie()
  const combined = headers.get('set-cookie')
  return combined ? combined.split(/,(?=\s*[^;,\s]+=)/g) : []
}

class PortalSession {
  private readonly cookies = new Map<string, string>()

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  private absorbCookies(headers: Headers) {
    for (const cookie of getSetCookies(headers)) {
      const firstPart = cookie.split(';', 1)[0]
      const separator = firstPart.indexOf('=')
      if (separator <= 0) continue
      const name = firstPart.slice(0, separator).trim()
      const value = firstPart.slice(separator + 1).trim()
      if (!name) continue
      const maxAge = /max-age\s*=\s*(-?\d+)/i.exec(cookie)?.[1]
      const expires = /expires\s*=\s*([^;]+)/i.exec(cookie)?.[1]
      const expired = expires ? Date.parse(expires) <= Date.now() : false
      if ((maxAge && Number(maxAge) <= 0) || expired || !value) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  async request(
    path: string,
    options: { method?: 'GET' | 'POST'; headers?: HeadersInit; body?: string; stage: PortalError['stage']; sendCookies?: boolean },
  ): Promise<Response> {
    let url = new URL(path, PORTAL)
    if (url.origin !== PORTAL) throw new PortalError(options.stage, 'invalid_upstream')
    let method = options.method || 'GET'
    let body = options.body
    for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
      const headers = new Headers(options.headers)
      if (options.sendCookies !== false && this.cookies.size) {
        headers.set('Cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '))
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      let response: Response
      try {
        response = await this.fetcher(url, {
          method,
          headers,
          body,
          redirect: 'manual',
          signal: controller.signal,
        })
      } catch {
        throw new PortalError(options.stage, 'network_or_timeout')
      } finally {
        clearTimeout(timeout)
      }
      this.absorbCookies(response.headers)
      if (response.status < 300 || response.status >= 400 || method === 'POST') return response
      if (redirectCount === 3) throw new PortalError(options.stage, 'redirect_loop')
      const location = response.headers.get('location')
      if (!location) throw new PortalError(options.stage, 'invalid_redirect')
      const next = new URL(location, url)
      if (next.origin !== PORTAL) throw new PortalError(options.stage, 'external_redirect')
      url = next
      method = 'GET'
      body = undefined
    }
    throw new PortalError(options.stage, 'redirect_loop')
  }

}

function isChallengePage(html: string): boolean {
  return /<title[^>]*>\s*(?:just a moment|attention required|access denied)|cf-chl-|challenge-platform/i.test(html)
}

function hasTurnstileWidget(html: string): boolean {
  return /cf-turnstile-response|class=["'][^"']*cf-turnstile|turnstile\.render|data-sitekey/i.test(html)
}

function csrfFromPage(html: string): string {
  if (isChallengePage(html)) throw new PortalError('page', 'challenge_required')
  if (hasTurnstileWidget(html)) throw new PortalError('page', 'challenge_required')
  const searchForm = /<form\b(?=[^>]*\baction\s*=\s*["']search-view-results\.php["'])[^>]*>([\s\S]*?)<\/form\s*>/i.exec(html)
  if (!searchForm) throw new PortalError('page', 'search_form_missing')
  const csrfInput = /<input\b(?=[^>]*\bname=["']csrf_token["'])[^>]*>/i.exec(searchForm[1])?.[0]
  const token = csrfInput ? /\bvalue=["']([^"']+)["']/i.exec(csrfInput)?.[1] : undefined
  if (!token) throw new PortalError('page', 'csrf_missing')
  return token
}

function addRelativeDate(date: string, value: string | undefined): string | null {
  if (!value) return null
  const absolute = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (absolute && isValidDate(value)) return value
  const relative = /^([+-]?\d+)\s*([dwmy])?$/i.exec(value.trim())
  if (!relative) return null
  const amount = Number(relative[1])
  const unit = (relative[2] || 'd').toLowerCase()
  const result = new Date(`${date}T00:00:00Z`)
  if (unit === 'd') result.setUTCDate(result.getUTCDate() + amount)
  else if (unit === 'w') result.setUTCDate(result.getUTCDate() + amount * 7)
  else if (unit === 'm') result.setUTCMonth(result.getUTCMonth() + amount)
  else result.setUTCFullYear(result.getUTCFullYear() + amount)
  return result.toISOString().slice(0, 10)
}

export function parseBookingWindow(html: string, now = new Date()): BookingWindow {
  const date = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const part = (type: string) => parts.find((value) => value.type === type)?.value || ''
    return `${part('year')}-${part('month')}-${part('day')}`
  })()
  const configuration = /\.datepicker\s*\(\s*\{([\s\S]*?)\}\s*\)/i.exec(html)?.[1] || html
  const min = /\bminDate\s*:\s*(?:["']([^"']+)["']|([^,\s}]+))/i.exec(configuration)
  const max = /\bmaxDate\s*:\s*(?:["']([^"']+)["']|([^,\s}]+))/i.exec(configuration)
  return {
    earliest: addRelativeDate(date, (min?.[1] || min?.[2] || '').trim()),
    latest: addRelativeDate(date, (max?.[1] || max?.[2] || '').trim()),
    discoveredAt: new Date().toISOString(),
  }
}

type Cached<T> = { value: T; expiresAt: number }
let stationCache: Cached<SgrStation[]> | undefined
const destinationCache = new Map<string, Cached<SgrStation[]>>()
let directoryLoad: Promise<SgrStation[]> | undefined

async function responseText(
  session: PortalSession,
  path: string,
  stage: PortalError['stage'],
  sendCookies = true,
): Promise<string> {
  const response = await session.request(path, { stage, sendCookies })
  if (response.status !== 200) throw new PortalError(stage, response.status === 429 ? 'rate_limited' : `http_${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('text/html')) throw new PortalError(stage, 'unexpected_content_type')
  const html = await response.text()
  if (isChallengePage(html)) throw new PortalError(stage, 'challenge_required')
  return html
}

async function pageWithSession(session: PortalSession): Promise<string> {
  const html = await responseText(session, '/index.php', 'page')
  csrfFromPage(html)
  return html
}

async function fetchStations(session: PortalSession): Promise<SgrStation[]> {
  const html = await responseText(
    session,
    `/fetch.php?type=terminals&schedule_type=${SCHEDULE_TYPE}`,
    'stations',
    false,
  )
  const found = parseStationOptions(html)
  if (!found.length) throw new PortalError('stations', 'empty_station_list')
  stationCache = { value: found, expiresAt: Date.now() + DIRECTORY_TTL_MS }
  return found
}

async function stationsFor(session: PortalSession): Promise<SgrStation[]> {
  if (stationCache && stationCache.expiresAt > Date.now()) return stationCache.value
  if (directoryLoad) return directoryLoad
  directoryLoad = fetchStations(session)
  try {
    return await directoryLoad
  } finally {
    directoryLoad = undefined
  }
}

async function fetchDestinations(session: PortalSession, origin: string): Promise<SgrStation[]> {
  const html = await responseText(
    session,
    `/fetch.php?type=destinations&schedule_type=${SCHEDULE_TYPE}&terminal_id=${encodeURIComponent(origin)}`,
    'destinations',
    false,
  )
  const found = parseStationOptions(html)
  const result = found.filter((station) => station.id !== origin)
  if (!result.length) throw new PortalError('destinations', 'empty_destination_list')
  destinationCache.set(origin, { value: result, expiresAt: Date.now() + DIRECTORY_TTL_MS })
  return result
}

async function destinationsFor(session: PortalSession, origin: string): Promise<SgrStation[]> {
  const cached = destinationCache.get(origin)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  return fetchDestinations(session, origin)
}

export async function getLiveDirectory(fetcher: typeof fetch = fetch) {
  const session = new PortalSession(fetcher)
  const html = await pageWithSession(session)
  const [foundStations] = await Promise.all([stationsFor(session)])
  return { stations: foundStations, window: parseBookingWindow(html) }
}

export async function getLiveDestinations(origin: string, fetcher: typeof fetch = fetch) {
  if (!/^\d+$/.test(origin)) throw new PortalError('destinations', 'invalid_origin')
  const cachedStations = stationCache && stationCache.expiresAt > Date.now()
    ? stationCache.value
    : undefined
  if (cachedStations && !cachedStations.some((station) => station.id === origin)) {
    throw new PortalError('destinations', 'invalid_origin')
  }
  const cachedDestinations = destinationCache.get(origin)
  if (cachedStations && cachedDestinations && cachedDestinations.expiresAt > Date.now()) {
    return cachedDestinations.value
  }
  const session = new PortalSession(fetcher)
  await pageWithSession(session)
  const knownStations = await stationsFor(session)
  if (!knownStations.some((station) => station.id === origin)) throw new PortalError('destinations', 'invalid_origin')
  return destinationsFor(session, origin)
}

function mapTrain(train: ParsedTrain) {
  return {
    trainNumber: train.trainNumber,
    departure: train.departure,
    arrival: train.arrival,
    economyAvailable: train.economyAvailable,
    firstClassAvailable: train.firstClassAvailable,
    economyFare: train.economyFare,
    firstClassFare: train.firstClassFare,
  }
}

export async function checkLiveAvailability(
  origin: string,
  destination: string,
  date: string,
  fetcher: typeof fetch = fetch,
): Promise<AvailabilityResult> {
  if (!/^\d+$/.test(origin) || !/^\d+$/.test(destination) || origin === destination || !isValidDate(date)) {
    throw new PortalError('search', 'invalid_query')
  }

  const session = new PortalSession(fetcher)
  const pageHtml = await pageWithSession(session)
  const window = parseBookingWindow(pageHtml)
  if ((window.earliest && date < window.earliest) || (window.latest && date > window.latest)) {
    return {
      date,
      status: 'outside-window',
      lastChecked: null,
      source: 'live',
      isLive: true,
      message: 'This date is outside the booking dates currently shown by the official portal.',
      trains: [],
    }
  }
  const stations = await stationsFor(session)
  if (!stations.some((station) => station.id === origin)) throw new PortalError('search', 'invalid_origin')
  const destinations = await destinationsFor(session, origin)
  if (!destinations.some((station) => station.id === destination)) throw new PortalError('search', 'invalid_destination')
  const csrfToken = csrfFromPage(pageHtml)
  const form = new URLSearchParams({
    csrf_token: csrfToken,
    schedule_type: SCHEDULE_TYPE,
    terminal_id: origin,
    destination_id: destination,
    'travel-date': `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`,
    depature_time: '',
  })
  const response = await session.request('/search-view-results.php', {
    method: 'POST',
    stage: 'search',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: PORTAL,
      Referer: `${PORTAL}/index.php`,
    },
    body: form.toString(),
  })
  if (response.status >= 300 && response.status < 400) {
    throw new PortalError('search', 'redirected_search')
  }
  if (response.status !== 200) {
    throw new PortalError('search', response.status === 429 ? 'rate_limited' : `http_${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('text/html')) throw new PortalError('search', 'unexpected_content_type')
  const html = await response.text()
  if (isChallengePage(html) || hasTurnstileWidget(html)) throw new PortalError('search', 'challenge_required')
  let parsedTrains: ParsedTrain[]
  try {
    parsedTrains = parseAvailabilityHtml(html)
  } catch (error) {
    if (error instanceof AvailabilityParseError) {
      const message = error.message.toLowerCase()
      throw new PortalError('search', message.includes('csrf') || message.includes('session') ? 'csrf_rejected' : 'invalid_response')
    }
    throw error
  }
  const trains = parsedTrains
    .filter((train) => train.date === date && train.origin === stations.find((item) => item.id === origin)?.name &&
      train.destination === destinations.find((item) => item.id === destination)?.name)
  if (!trains.length) {
    return {
      date,
      status: 'unavailable',
      lastChecked: null,
      source: 'live',
      isLive: true,
      message: 'The official portal returned no verifiable train results for this date.',
      trains: [],
    }
  }
  const hasSeats = trains.some((train) => train.economyAvailable > 0 || train.firstClassAvailable > 0)
  return {
    date,
    status: hasSeats ? 'available' : 'sold-out',
    lastChecked: new Date().toISOString(),
    source: 'live',
    isLive: true,
    trains: trains.map(mapTrain),
  }
}
