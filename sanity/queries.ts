import { defineQuery } from 'next-sanity'

export const REVIEWS_QUERY = defineQuery(`
  *[_type == "review" && approved == true] | order(publishedAt desc) {
    _id,
    name,
    rating,
    title,
    body,
    publishedAt
  }
`)

export const FAQS_QUERY = defineQuery(`
  *[_type == "faq"] | order(order asc) {
    _id,
    question,
    answer
  }
`)

export const SITE_SETTINGS_QUERY = defineQuery(`
  *[_id == "siteSettings" || _type == "siteSettings"][0] {
    heroImage,
    economyImage,
    firstClassImage,
    premiumImage,
    aboutImage,
    whatsappNumber,
    email
  }
`)

export const PAGE_CONTENT_QUERY = defineQuery(`
  *[_id == "pageContent" || _type == "pageContent"][0] {
    heroEyebrow,
    heroHeadline,
    heroSubtext,
    heroCaveat,
    infoStrip,
    pricingTitle,
    pricingSubtext,
    economyFeatures,
    firstClassFeatures,
    premiumFeatures,
    footerDisclaimer,
    fraudAlert
  }
`)

