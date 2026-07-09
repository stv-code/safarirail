export const siteConfig = {
  name: 'SafariRail',
  url: 'https://safarirail.co.ke',
  supportEmail: 'support@safarirail.co.ke',
  whatsappNumber: '254769869503',
  whatsappDisplay: '+254 769 869 503',
  officialKrcUrl: 'https://metickets.krc.co.ke',
  officialKrcBookingUrl: 'https://metickets.krc.co.ke/index.php',
  officialKrcFaqUrl: 'https://metickets.krc.co.ke/faqs.php',
  privacyPolicyUrl: '/privacy',
} as const

export const whatsappBaseUrl = `https://wa.me/${siteConfig.whatsappNumber}`

export const departures = ['Morning (08:00)', 'Afternoon (15:00)', 'Night (22:00)'] as const

export const genders = ['Male', 'Female'] as const

export const ticketClasses = [
  {
    key: 'economy',
    label: 'Economy',
    adultPrice: 2000,
    childPrice: 1250,
    service: 500,
    ticketAdult: 1500,
    ticketChild: 750,
    badge: 'Most Popular',
    features: ['Standard comfortable seating', 'Air conditioning throughout', 'Luggage storage space', 'Traveller booking support'],
  },
  {
    key: 'first',
    label: 'First Class',
    adultPrice: 5500,
    childPrice: 3250,
    service: 1000,
    ticketAdult: 4500,
    ticketChild: 2250,
    badge: '',
    features: ['Reclining spacious seats', 'Premium lounge access', 'Tray tables & power outlets', 'Priority boarding'],
  },
  {
    key: 'premium',
    label: 'Premium',
    adultPrice: 13500,
    childPrice: 7500,
    service: 1500,
    ticketAdult: 12000,
    ticketChild: 6000,
    badge: '',
    features: ['Private luxury compartment', 'Complimentary meals & drinks', 'Personal concierge service', 'Best views through Tsavo'],
  },
] as const

export const paymentMethods = [
  { method: 'Wise', detail: 'Transfer to M-Pesa - 0769 869 503' },
  { method: 'Remitly', detail: 'Transfer to M-Pesa - 0769 869 503' },
  { method: 'Sendwave', detail: 'Transfer to M-Pesa - 0769 869 503' },
  { method: 'Western Union', detail: 'Contact us for recipient details' },
  { method: 'Crypto (USDT/BTC/BNB)', detail: 'WhatsApp for wallet address' },
] as const

export const bookingExperience = {
  responseTimeLabel: 'Typical confirmation time: within 5-10 minutes during business hours, 8am-10pm EAT.',
  steps: [
    'Submit your booking request.',
    'We confirm seat availability and payment instructions.',
    'Receive your booking reference and continue on WhatsApp for final confirmation.',
  ],
} as const

export const bookingLimits = {
  minAdults: 1,
  maxAdults: 6,
  minChildren: 0,
  maxChildren: 4,
} as const

export type TicketClassLabel = (typeof ticketClasses)[number]['label']
export type Departure = (typeof departures)[number]
export type Gender = (typeof genders)[number]

export function formatKes(amount: number) {
  return amount.toLocaleString('en-KE')
}

export function getTicketClass(label: string) {
  return ticketClasses.find((ticketClass) => ticketClass.label === label)
}

export function calculateBookingTotal(travelClass: TicketClassLabel, adults: number, children: number) {
  const selectedClass = getTicketClass(travelClass)
  if (!selectedClass) throw new Error(`Unknown ticket class: ${travelClass}`)
  return adults * selectedClass.adultPrice + children * selectedClass.childPrice
}
