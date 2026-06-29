import { getFaqs, getSiteSettings, getReviews, getPageContent } from '@/sanity/client'
import HomeClient from './HomeClient'

export const revalidate = 60

export default async function Home() {
  const [faqs, settings, reviews, content] = await Promise.all([
    getFaqs().catch(() => []),
    getSiteSettings().catch(() => null),
    getReviews().catch(() => []),
    getPageContent().catch(() => null),
  ])

  return <HomeClient faqs={faqs} settings={settings} reviews={reviews} content={content} />
}
