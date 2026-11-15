export type SgrStation = { id: string; name: string }
export type AvailabilityStatus = 'available' | 'sold-out' | 'unchecked' | 'unavailable' | 'outside-window'

export type ProviderTrain = {
  trainNumber: string
  departure: string
  arrival: string
  economyAvailable: number
  firstClassAvailable: number
  economyFare: number
  firstClassFare: number
}

export type AvailabilityQuery = { origin: string; destination: string; date: string }
export type AvailabilityResult = {
  date: string
  status: 'available' | 'sold-out' | 'unavailable' | 'outside-window'
  lastChecked: string | null
  source: 'none' | 'live' | 'historical-fixture'
  isLive: boolean
  message?: string
  trains: ProviderTrain[]
}
export interface SgrAvailabilityProvider {
  check(query: AvailabilityQuery): Promise<AvailabilityResult>
}

// Development-only station values. Production station/destination lists are
// retrieved dynamically by the live Cloudflare Pages provider.
export const stations: SgrStation[] = [
  { id: 'nairobi-terminus', name: 'Nairobi Terminus' },
  { id: 'mombasa-terminus', name: 'Mombasa Terminus' },
]

export function destinationsFor(origin: string): SgrStation[] {
  return stations.filter((station) => station.id !== origin && stations.some((candidate) => candidate.id === origin))
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

export function formatDate(value: string): string {
  if (!isValidDate(value)) throw new Error('Invalid travel date')
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

// Explicit no-live-data adapter retained for isolated tests. Production API
// routes use checkLiveAvailability and never fall back to this provider.
function validateQuery(origin: string, destination: string, date: string) {
  if (!stations.some((station) => station.id === origin) ||
      !stations.some((station) => station.id === destination) ||
      origin === destination ||
      !isValidDate(date)) {
    throw new Error('Invalid availability query')
  }
}

export const unavailableProvider: SgrAvailabilityProvider = {
  async check({ date }) {
    return {
      date,
      status: 'unavailable',
      lastChecked: null,
      source: 'none',
      isLive: false,
      message: 'Live seat information is not available yet. Please check the official Kenya Railways portal.',
      trains: [],
    }
  },
}

export async function checkAvailability(
  origin: string,
  destination: string,
  date: string,
): Promise<AvailabilityResult> {
  validateQuery(origin, destination, date)
  return unavailableProvider.check({ origin, destination, date })
}
