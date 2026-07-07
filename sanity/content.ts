import { draftMode } from 'next/headers'
import type { ClientPerspective } from 'next-sanity'
import { hasSanityConfig } from './env'
import { sanityFetch } from './live'
import {
  FAQS_QUERY,
  PAGE_CONTENT_QUERY,
  REVIEWS_QUERY,
  SITE_SETTINGS_QUERY,
} from './queries'

type FetchOptions<T> = {
  source: string
  query: string
  fallback: T
  tags: string[]
}

async function safeSanityFetch<T>({ source, query, fallback, tags }: FetchOptions<T>): Promise<T> {
  if (!hasSanityConfig) return fallback

  const isDraftMode = draftMode().isEnabled
  const perspective: ClientPerspective = isDraftMode ? 'drafts' : 'published'

  try {
    const { data } = await sanityFetch({
      query,
      tags,
      perspective,
      stega: isDraftMode,
    })

    return (data ?? fallback) as T
  } catch (error) {
    console.error(`Failed to load Sanity ${source}`, error)
    return fallback
  }
}

export async function getReviews() {
  return safeSanityFetch({
    source: 'reviews',
    query: REVIEWS_QUERY,
    fallback: [],
    tags: ['sanity', 'review'],
  })
}

export async function getFaqs() {
  return safeSanityFetch({
    source: 'FAQs',
    query: FAQS_QUERY,
    fallback: [],
    tags: ['sanity', 'faq'],
  })
}

export async function getSiteSettings() {
  return safeSanityFetch({
    source: 'site settings',
    query: SITE_SETTINGS_QUERY,
    fallback: null,
    tags: ['sanity', 'siteSettings'],
  })
}

export async function getPageContent() {
  return safeSanityFetch({
    source: 'page content',
    query: PAGE_CONTENT_QUERY,
    fallback: null,
    tags: ['sanity', 'pageContent'],
  })
}

