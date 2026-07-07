import { getFaqs, getSiteSettings, getReviews, getPageContent } from '@/sanity/client'
import HomeClient from './HomeClient'

export const revalidate = 60

async function withFallback<T, F>(source: string, promise: Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await promise
  } catch (error) {
    console.error(`Failed to load ${source}`, error)
    return fallback
  }
}

export default async function Home() {
  const [faqs, settings, reviews, content] = await Promise.all([
    withFallback('FAQs', getFaqs(), []),
    withFallback('site settings', getSiteSettings(), null),
    withFallback('reviews', getReviews(), []),
    withFallback('page content', getPageContent(), null),
  ])

  return <HomeClient faqs={faqs} settings={settings} reviews={reviews} content={content} />
}
