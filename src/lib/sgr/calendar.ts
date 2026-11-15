import { isValidDate, type AvailabilityResult } from './provider'
import { validSchedule, type ScheduleType } from './live'

export type RouteQuery = { origin: string; destination: string; service: ScheduleType; departure: string }
export function routeQuery(url: URL): RouteQuery {
  const origin = url.searchParams.get('origin') || ''
  const destination = url.searchParams.get('destination') || ''
  const service = url.searchParams.get('service') || 'inter_county'
  const departure = service === 'express' ? url.searchParams.get('departure') || '3.00' : ''
  if (!/^\d{1,3}$/.test(origin) || !/^\d{1,3}$/.test(destination) || origin === destination ||
      !validSchedule(service) || (service === 'express' && !['3.00', '10.00'].includes(departure))) {
    throw new Error('Choose a valid route and service.')
  }
  return { origin, destination, service, departure }
}
export function nairobiToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
export function monthDates(month: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(month) || !isValidDate(`${month}-01`)) throw new Error('Choose a valid month.')
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}
export function seatTotal(result: Pick<AvailabilityResult, 'trains'>): number {
  return result.trains.reduce((sum, train) => sum + train.economyAvailable + train.firstClassAvailable, 0)
}
export type CalendarDay = {
  date: string; status: AvailabilityResult['status'] | 'unchecked'; seats?: number
  economy?: number; firstClass?: number; lastChecked: string | null
  trains?: AvailabilityResult['trains']
}
export function calendarDay(result: AvailabilityResult): CalendarDay {
  const confirmed = result.status === 'available' || result.status === 'sold-out'
  return { date: result.date, status: result.status, lastChecked: result.lastChecked,
    ...(confirmed ? { seats: seatTotal(result),
      economy: result.trains.reduce((sum, train) => sum + train.economyAvailable, 0),
      firstClass: result.trains.reduce((sum, train) => sum + train.firstClassAvailable, 0), trains: result.trains } : {}),
  }
}
