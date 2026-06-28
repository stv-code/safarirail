import { createClient } from 'next-sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = imageUrlBuilder(client)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// Queries
export async function getReviews() {
  return client.fetch(
    `*[_type == "review" && approved == true] | order(publishedAt desc) {
      _id, name, rating, title, body, publishedAt
    }`
  )
}

export async function getFaqs() {
  return client.fetch(
    `*[_type == "faq"] | order(order asc) {
      _id, question, answer
    }`
  )
}

export async function getSiteSettings() {
  return client.fetch(
    `*[_type == "siteSettings"][0] {
      heroImage, economyImage, firstClassImage, premiumImage, aboutImage,
      whatsappNumber, email
    }`
  )
}
