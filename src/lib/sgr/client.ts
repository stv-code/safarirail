export type AvailabilityResponse = {
  date?: string
  status?: 'available' | 'sold-out' | 'unchecked' | 'unavailable' | 'outside-window'
  lastChecked?: string | null
  cached?: boolean
  source?: 'none' | 'live' | 'historical-fixture'
  message?: string
  trains?: Array<{
    trainNumber: string
    departure: string
    arrival: string
    economyAvailable: number
    firstClassAvailable: number
    economyFare: number
    firstClassFare: number
  }>
}

export async function fetchAvailability(
  origin: string,
  destination: string,
  date: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<{ ok: boolean; data: AvailabilityResponse }> {
  const query = new URLSearchParams({ origin, destination, date })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('Availability check timed out', 'TimeoutError')), timeoutMs)
  try {
    const response = await fetcher(`/api/sgr/availability?${query}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    return { ok: response.ok, data: await response.json() as AvailabilityResponse }
  } finally {
    clearTimeout(timeout)
  }
}
