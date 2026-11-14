export type AvailabilityResponse = {
  date?: string
  status?: string
  lastChecked?: string | null
  message?: string
  trains?: unknown[]
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
      signal: controller.signal,
    })
    return { ok: response.ok, data: await response.json() as AvailabilityResponse }
  } finally {
    clearTimeout(timeout)
  }
}
