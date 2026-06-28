import { getFaqs, getSiteSettings, getReviews } from '@/sanity/client'
import HomeClient from './HomeClient'

export const revalidate = 60

export default async function Home() {
  const [faqs, settings, reviews] = await Promise.all([
    getFaqs().catch(() => []),
    getSiteSettings().catch(() => null),
    getReviews().catch(() => []),
  ])

  return <HomeClient faqs={faqs} settings={settings} reviews={reviews} />
}
