'use client'
import { useState } from 'react'
import Image from 'next/image'
import Nav from '@/components/Nav'
import BookingModal from '@/components/BookingModal'
import { urlFor } from '@/sanity/client'

type ClassKey = 'economy' | 'first' | 'premium'

interface Faq { _id: string; question: string; answer: string }
interface Review { _id: string; name: string; rating: number; title: string; body: string }
interface Settings {
  heroImage?: any
  economyImage?: any
  firstClassImage?: any
  premiumImage?: any
  whatsappNumber?: string
  email?: string
}

const STATIC_FAQS = [
  { _id: '1', question: 'Are you the official SGR website?', answer: 'No. We are a private third-party agency helping tourists book tickets. We are NOT selling tickets — we assist you in booking them. The official website is metickets.krc.co.ke.' },
  { _id: '2', question: 'How do I receive my ticket?', answer: 'After booking, we send the M-Pesa message and ticket number to your email, WhatsApp, or Telegram. You MUST use this message to physically print your ticket at the station before boarding.' },
  { _id: '3', question: 'What payment methods do you accept?', answer: 'We accept PayPal, Wise, Remitly, Sendwave, and Western Union (all remitted to M-Pesa), as well as USDT, BTC, and BNB crypto.' },
  { _id: '4', question: 'What is your refund and cancellation policy?', answer: 'We do not handle refunds. Cancellation is strictly handled by Kenya Railways in person at the station.' },
  { _id: '5', question: 'Do children travel for free?', answer: 'Children under 3 years travel free. Children aged 3–11 pay a reduced child fare.' },
]

export default function HomeClient({
  faqs,
  settings,
  reviews,
}: {
  faqs: Faq[]
  settings: Settings | null
  reviews: Review[]
}) {
  const [selectedClass, setSelectedClass] = useState<ClassKey | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const displayFaqs = faqs.length > 0 ? faqs : STATIC_FAQS
  const whatsapp = settings?.whatsappNumber || '254769869503'
  const email = settings?.email || 'safarirailbookings@gmail.com'

  const classImages: Record<ClassKey, any> = {
    economy: settings?.economyImage,
    first: settings?.firstClassImage,
    premium: settings?.premiumImage,
  }

  return (
    <>
      <Nav />

      {/* Hero */}
      <section className="hero" id="hero" style={{ position: 'relative', overflow: 'hidden' }}>
        {settings?.heroImage && (
          <Image
            src={urlFor(settings.heroImage).width(1400).height(600).url()}
            alt="Madaraka Express SGR"
            fill
            style={{ objectFit: 'cover', opacity: 0.18, zIndex: 0 }}
            priority
          />
        )}
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-eyebrow">
            <span>🚂</span> Madaraka Express · Nairobi ↔ Mombasa
          </div>
          <h1>Experience Kenya <em>by Rail</em></h1>
          <p className="hero-sub">
            The hassle-free way for tourists to book SGR tickets. No M-Pesa? No Kenyan bank account? No problem.
          </p>
          <p className="hero-caveat">
            Not comfortable with third parties? We encourage you to book directly at the station.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => {
              document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
            }}>
              Start Booking →
            </button>
            <a
              href="https://metickets.krc.co.ke/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Official KRC Site ↗
            </a>
          </div>
        </div>
        <div className="hero-track" aria-hidden="true" />
      </section>

      {/* Notice strip */}
      <div className="info-strip">
        <div className="container">
          <div className="info-strip-inner">
            <span className="info-strip-item">⚠️ Third-party booking agency — not affiliated with Kenya Railways Corporation</span>
            <span className="info-strip-item">🎫 Tickets delivered via Email, WhatsApp or Telegram</span>
            <span className="info-strip-item">🌍 PayPal · Wise · Crypto accepted</span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-eyebrow">Ticket Classes</div>
          <h2 className="section-title">Choose Your Journey</h2>
          <p className="section-sub">
            All prices include our booking assistance fee. Select the class that suits your travel style.
          </p>

          <div className="pricing-grid">
            {([
              {
                key: 'economy' as ClassKey,
                label: 'Economy',
                adultPrice: '2,000',
                childPrice: '1,250',
                service: 500,
                ticketAdult: 1500,
                ticketChild: 750,
                featured: true,
                badge: 'Most Popular',
                features: ['Standard comfortable seating', 'Air conditioning throughout', 'Luggage storage space', 'Traveller booking support'],
              },
              {
                key: 'first' as ClassKey,
                label: 'First Class',
                adultPrice: '5,500',
                childPrice: '3,250',
                service: 1000,
                ticketAdult: 4500,
                ticketChild: 2250,
                featured: false,
                badge: null,
                features: ['Reclining spacious seats', 'Premium lounge access', 'Tray tables & power outlets', 'Priority boarding'],
              },
              {
                key: 'premium' as ClassKey,
                label: 'Premium',
                adultPrice: '13,500',
                childPrice: '7,500',
                service: 1500,
                ticketAdult: 12000,
                ticketChild: 6000,
                featured: false,
                badge: null,
                features: ['Private luxury compartment', 'Complimentary meals & drinks', 'Personal concierge service', 'Best views through Tsavo'],
              },
            ]).map(cls => (
              <div key={cls.key} className={`pricing-card${cls.featured ? ' featured' : ''}`}>
                {cls.badge && <div className="pricing-badge">{cls.badge}</div>}

                {/* Class image from Sanity */}
                {classImages[cls.key] && (
                  <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16, height: 140, position: 'relative' }}>
                    <Image
                      src={urlFor(classImages[cls.key]).width(600).height(280).url()}
                      alt={`${cls.label} class interior`}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                )}

                <div className="pricing-tier">{cls.label}</div>
                <div className="pricing-price"><sup>KES</sup> {cls.adultPrice}</div>
                <div className="pricing-unit">per adult</div>
                <div className="pricing-breakdown">
                  <strong>Fare Breakdown</strong>
                  Adult: {cls.adultPrice} (ticket {cls.ticketAdult.toLocaleString()} + service {cls.service})<br />
                  Child (3–11): {cls.childPrice} (ticket {cls.ticketChild.toLocaleString()} + service {cls.service})<br />
                  Child (&lt;3): Free
                </div>
                <ul className="pricing-features">
                  {cls.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                <button className="btn-book" onClick={() => setSelectedClass(cls.key)}>
                  Select {cls.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="section" style={{ background: 'var(--savanna-light)' }}>
          <div className="container">
            <div className="section-eyebrow">Traveller Feedback</div>
            <h2 className="section-title">What People Say</h2>
            <div className="reviews-grid">
              {reviews.slice(0, 4).map(r => (
                <div key={r._id} className="review-card">
                  <div className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <div className="review-title">{r.title}</div>
                  <p className="review-text">&ldquo;{r.body}&rdquo;</p>
                  <div className="review-author">— {r.name}</div>
                </div>
              ))}
            </div>
            <a href="/reviews" style={{ color: 'var(--savanna-dark)', fontWeight: 600, textDecoration: 'underline', fontSize: '0.9rem' }}>
              See all reviews →
            </a>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="section" id="faq" style={{ background: 'var(--rail-light)' }}>
        <div className="container">
          <div className="section-eyebrow">Common Questions</div>
          <h2 className="section-title">Frequently Asked</h2>
          <p className="section-sub">Everything you need to know before booking with us.</p>

          <div className="faq-list" style={{ maxWidth: 720 }}>
            {displayFaqs.map((faq, i) => (
              <div key={faq._id} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.question}
                  <span className="faq-chevron">▾</span>
                </button>
                <div className="faq-answer">{faq.answer}</div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            More questions?{' '}
            <a href="https://metickets.krc.co.ke/faqs.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--savanna-dark)', textDecoration: 'underline' }}>
              View official KRC FAQs →
            </a>
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="section" id="contact">
        <div className="container">
          <div className="section-eyebrow">Get in Touch</div>
          <h2 className="section-title">Need Help?</h2>
          <p className="section-sub">Custom itineraries, group bookings, or general questions.</p>

          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-card">
                <span className="contact-icon">📧</span>
                <div>
                  <div className="contact-label">Email</div>
                  <a href={`mailto:${email}`} className="contact-value">{email}</a>
                </div>
              </div>
              <div className="contact-card">
                <span className="contact-icon">📱</span>
                <div>
                  <div className="contact-label">WhatsApp</div>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="contact-value">
                    +{whatsapp}
                  </a>
                </div>
              </div>
              <div className="fraud-alert">
                <strong>⚠️ Fraud Alert:</strong> If you suspect fraudulent activity in our name, contact DCI Kenya, call 911, or visit the nearest police station immediately.
              </div>
            </div>

            <form className="contact-form" onSubmit={e => { e.preventDefault(); alert('Message sent! We will reply shortly.') }}>
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input className="form-input" type="text" placeholder="John Smith" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" placeholder="john@example.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-textarea" placeholder="I need help with a group booking for..." required />
              </div>
              <button type="submit" className="btn-send">Send Message</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-logo">Safari<span>Rail</span></div>
            <nav className="footer-links" aria-label="Footer navigation">
              <a href="/#pricing">Classes</a>
              <a href="/reviews">Reviews</a>
              <a href="/#faq">FAQ</a>
              <a href="/#contact">Contact</a>
            </nav>
          </div>
          <p className="footer-disclaimer">
            SafariRail is an independent third-party booking agency. Not affiliated with, endorsed by, or representing Kenya Railways Corporation (KRC). The official KRC ticketing site is{' '}
            <a href="https://metickets.krc.co.ke" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>
              metickets.krc.co.ke
            </a>.
          </p>
        </div>
      </footer>

      <BookingModal
        selectedClass={selectedClass}
        onClose={() => setSelectedClass(null)}
        whatsapp={whatsapp}
        email={email}
      />
    </>
  )
}
