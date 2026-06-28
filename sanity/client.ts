import { createClient, type SanityClient } from 'next-sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export const client: SanityClient | null = projectId
  ? createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: true })
  : null

export function urlFor(source: SanityImageSource) {
  if (!client) {
    // Return a chainable stub that resolves to empty string
    const stub = { width: () => stub, height: () => stub, url: () => '' }
    return stub
  }
  return imageUrlBuilder(client).image(source)
}

async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!client) return fallback
  try { return await fn() } catch { return fallback }
}

export async function getReviews() {
  return safeFetch(() => client!.fetch(
    `*[_type == "review" && approved == true] | order(publishedAt desc) { _id, name, rating, title, body, publishedAt }`
  ), [])
}

export async function getFaqs() {
  return safeFetch(() => client!.fetch(
    `*[_type == "faq"] | order(order asc) { _id, question, answer }`
  ), [])
}

export async function getSiteSettings() {
  return safeFetch(() => client!.fetch(
    `*[_type == "siteSettings"][0] { heroImage, economyImage, firstClassImage, premiumImage, aboutImage, whatsappNumber, email }`
  ), null)
}
