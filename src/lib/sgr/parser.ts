import { isValidDate } from './provider'

export type ParsedTrain = {
  trainId: string
  trainNumber: string
  origin: string
  destination: string
  departure: string
  arrival: string
  date: string
  economyAvailable: number
  firstClassAvailable: number
  economyFare: number
  firstClassFare: number
}
export type ParsedStation = { id: string; name: string }

export function parseStationOptions(html: string): ParsedStation[] {
  if (typeof html !== 'string' || !/<option\b/i.test(html)) {
    throw new AvailabilityParseError('Response does not contain station options')
  }
  const stations: ParsedStation[] = []
  for (const option of html.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option\s*>/gi)) {
    const attr = attributes(option[1])
    const id = attr.value?.trim()
    const name = decodeHtml(option[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
    if (!id || !name) continue
    if (stations.some((station) => station.id === id)) throw new AvailabilityParseError('Duplicate station id')
    stations.push({ id, name })
  }
  return stations
}

export class AvailabilityParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvailabilityParseError'
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {}
  const expression = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  for (const match of tag.matchAll(expression)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

function fieldValues(html: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
    const attr = attributes(input[0])
    if (attr.name) values[attr.name] = attr.value ?? ''
  }
  return values
}

function numericField(fields: Record<string, string>, name: string): number {
  const value = fields[name]
  if (!value || !/^\d+$/.test(value)) throw new AvailabilityParseError(`Missing or invalid ${name} field`)
  return Number(value)
}

function clock(timestamp: string, field: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):\d{2}$/.exec(timestamp)
  if (!match || !isValidDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59) {
    throw new AvailabilityParseError(`Missing or invalid ${field} timestamp`)
  }
  return { date: match[1], time: `${match[2]}:${match[3]}` }
}

/**
 * Parse captured result cards only. This function never submits forms, uses
 * CSRF tokens, follows redirects, or treats an empty/error page as sold out.
 */
export function parseAvailabilityHtml(html: string): ParsedTrain[] {
  if (typeof html !== 'string' || !/<html\b|<form\b|<section\b/i.test(html)) {
    throw new AvailabilityParseError('Response is not an HTML results page')
  }
  if (/<title[^>]*>\s*(?:just a moment|attention required|access denied)|cf-chl-|challenge-platform/i.test(html)) {
    throw new AvailabilityParseError('The source returned an access challenge')
  }
  if (/(?:invalid|expired|missing)\s+(?:csrf|session)|csrf\s+(?:token\s+)?(?:invalid|expired|failed)|session has expired/i.test(html)) {
    throw new AvailabilityParseError('The source returned an expired session or CSRF error')
  }

  const cards = [...html.matchAll(/<form\b(?=[^>]*\baction\s*=\s*["']booking-details\.php["'])[^>]*>([\s\S]*?)<\/form\s*>/gi)]
  const results: ParsedTrain[] = []
  for (const card of cards) {
    const content = card[1]
    const heading = /<h2\b[^>]*>\s*Train\s+([^<]+?)\s*<\/h2>/i.exec(content)
    if (!heading) continue
    const fields = fieldValues(content)
    const departure = clock(fields.departure || '', 'departure')
    const arrival = clock(fields.arrival || '', 'arrival')
    if (departure.date !== arrival.date) throw new AvailabilityParseError('Train timestamps use different travel dates')

    const route = decodeHtml(heading[1]).match(/^([^\s]+)\s*-\s*(.+?)\s+to\s+(.+)$/i)
    if (!route) throw new AvailabilityParseError('Train heading is missing its number or route')
    if (fields.train && fields.train !== route[1]) throw new AvailabilityParseError('Train number fields do not match')
    if (!fields.fromTerminal || !fields.toTerminal) throw new AvailabilityParseError('Train route fields are missing')
    if (fields.fromTerminal !== route[2].trim() || fields.toTerminal !== route[3].trim()) {
      throw new AvailabilityParseError('Train route fields do not match')
    }

    results.push({
      trainId: fields.idTrain || '',
      trainNumber: fields.train || route[1],
      origin: fields.fromTerminal,
      destination: fields.toTerminal,
      departure: departure.time,
      arrival: arrival.time,
      date: departure.date,
      economyAvailable: numericField(fields, 'ecoOpen'),
      firstClassAvailable: numericField(fields, 'firstOpen'),
      economyFare: numericField(fields, 'ecoAdult'),
      firstClassFare: numericField(fields, 'firstAdult'),
    })
  }
  return results
}
