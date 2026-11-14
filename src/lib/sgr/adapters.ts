import { parseAvailabilityHtml } from './parser'
import type { SgrAvailabilityProvider } from './provider'

/**
 * Offline fixture adapter for parser and UI development. It only answers
 * selections present in its captured HTML and labels every result historical.
 * It is deliberately not installed in the Cloudflare API route.
 */
export function createHistoricalFixtureProvider(
  capturedHtml: string,
  capturedAt: string,
): SgrAvailabilityProvider {
  const capturedTrains = parseAvailabilityHtml(capturedHtml)
  return {
    async check(query) {
      const routeAliases: Record<string, string> = {
        'nairobi-terminus': 'Nairobi Terminus',
        'mombasa-terminus': 'Mombasa Terminus',
      }
      const origin = routeAliases[query.origin] || query.origin
      const destination = routeAliases[query.destination] || query.destination
      const trains = capturedTrains.filter((train) =>
        train.date === query.date && train.origin === origin && train.destination === destination)
      if (!trains.length) {
        return {
          date: query.date,
          status: 'unavailable',
          lastChecked: null,
          source: 'historical-fixture',
          isLive: false,
          message: 'No matching date and route exists in the historical test fixture.',
          trains: [],
        }
      }
      const available = trains.some((train) => train.economyAvailable > 0 || train.firstClassAvailable > 0)
      return {
        date: query.date,
        status: available ? 'available' : 'sold-out',
        lastChecked: capturedAt,
        source: 'historical-fixture',
        isLive: false,
        message: 'Historical HAR fixture for testing only. This is not current availability.',
        trains,
      }
    },
  }
}
