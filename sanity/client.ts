import { createClient, type SanityClient } from 'next-sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { apiVersion, dataset, projectId, studioUrl } from './env'

export const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  stega: {
    studioUrl,
    enabled: process.env.NODE_ENV !== 'production',
  },
})

export function urlFor(source: SanityImageSource) {
  if (!source) {
    const stub = { width: () => stub, height: () => stub, url: () => '' }
    return stub
  }
  return imageUrlBuilder(client).image(source)
}
