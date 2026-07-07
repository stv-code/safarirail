import { getFaqs, getSiteSettings, getReviews, getPageContent } from '@/sanity/content'
import HomeClient from './HomeClient'

export const revalidate = 60

export default async function Home() {
  const [faqs, settings, reviews, content] = await Promise.all([
    getFaqs(),
    getSiteSettings(),
    getReviews(),
    getPageContent(),
  ])

  return <HomeClient faqs={faqs} settings={settings} reviews={reviews} content={content} />
}
