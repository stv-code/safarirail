import { defineLive } from 'next-sanity'
import { client } from './client'

export const { sanityFetch, SanityLive, SanityLiveStream } = defineLive({
  client,
  serverToken: process.env.SANITY_API_READ_TOKEN,
  browserToken: process.env.NEXT_PUBLIC_SANITY_BROWSER_TOKEN,
  fetchOptions: {
    revalidate: 60,
  },
})

