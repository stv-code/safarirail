'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import BookingModal from '@/components/BookingModal'

type ClassKey = 'economy' | 'first' | 'premium'

const FAQS = [
  {
    q: 'Are you the official SGR website?',
    a: 'No. We are a private third-party agency helping tourists book tickets. We are NOT selling tickets — we assist you in booking them. The official website is <a href="https://metickets.krc.co.ke/index.php" target="_blank" rel="noopener">metickets.krc.co.ke</a>.',
  },
  {
    q: 'How do I receive my ticket?',
    a: 'After booking, we send the M-Pesa message and ticket number to your email, WhatsApp, or Telegram. You MUST use this message to physically print your ticket at the station before boarding.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept PayPal, Wise, Remitly, Sendwave, and Western Union (all remitted to M-Pesa), as well as USDT, BTC, and BNB crypto. Contact us via WhatsApp for crypto wallet addresses.',
  },
  {
    q: 'What if there are payment delays?',
    a: 'The user is fully responsible for any delays during money transfer (e.g. Wise/Remitly processing times). We can only book the ticket once funds are received.',
  },
  {
    q: 'What is your refund and cancellation policy?',
    a: 'We do not handle refunds. Cancellation is strictly handled by Kenya Railways in person at the station. <a href="https://metickets.krc.co.ke/faqs.php" target="_blank" rel="noopener">View official policy →</a>',
  },
  {
    q: 'Do children travel for free?',
    a: 'Children under 3 years travel free. Children aged 3–11 pay a reduced child fare. Our pricing table shows exact breakdown per class including the service fee.',
  },
]

export default function Home() {
  const [selectedClass, setSelectedClass] = useState<ClassKey | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <>
      <Nav />

      {/* Hero */}
      <section className="hero" id="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <span>🚂</span> Madaraka Express · Nairobi ↔ Mombasa
          </div>
          <h1>Experience Kenya <em>by Rail</em></h1>
          <p className="hero-sub">
            The hassle-free way for tourists to book SGR tickets. No M-Pesa? No Kenyan bank account? No problem.
          </p>
          <p className="hero-caveat">
            Not comfortable with third parties? We encourage you to book directly at the station — we&apos;re here for those who can&apos;t.
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
            {/* Economy */}
            <div className="pricing-card featured">
              <div className="pricing-badge">Most Popular</div>
              <div className="pricing-tier">Economy</div>
              <div className="pricing-price"><sup>KES</sup> 2,000</div>
              <div className="pricing-unit">per adult</div>
              <div className="pricing-breakdown">
                <strong>Fare Breakdown</strong>
                Adult: 2,000 (ticket 1,500 + service 500)<br />
                Child (3–11): 1,250 (ticket 750 + service 500)<br />
                Child (&lt;3): Free
              </div>
              <ul className="pricing-features">
                <li>Standard comfortable seating</li>
                <li>Air conditioning throughout</li>
                <li>Luggage storage space</li>
                <li>Traveller booking support</li>
              </ul>
              <button className="btn-book" onClick={() => setSelectedClass('economy')}>
                Select Economy
              </button>
            </div>

            {/* First Class */}
            <div className="pricing-card">
              <div className="pricing-tier">First Class</div>
              <div className="pricing-price"><sup>KES</sup> 5,500</div>
              <div className="pricing-unit">per adult</div>
              <div className="pricing-breakdown">
                <strong>Fare Breakdown</strong>
                Adult: 5,500 (ticket 4,500 + service 1,000)<br />
                Child (3–11): 3,250 (ticket 2,250 + service 1,000)<br />
                Child (&lt;3): Free
              </div>
              <ul className="pricing-features">
                <li>Reclining spacious seats</li>
                <li>Premium lounge access</li>
                <li>Tray tables &amp; power outlets</li>
                <li>Priority boarding</li>
              </ul>
              <button className="btn-book" onClick={() => setSelectedClass('first')}>
                Select First Class
              </button>
            </div>

            {/* Premium */}
            <div className="pricing-card">
              <div className="pricing-tier">Premium</div>
              <div className="pricing-price"><sup>KES</sup> 13,500</div>
              <div className="pricing-unit">per adult</div>
              <div className="pricing-breakdown">
                <strong>Fare Breakdown</strong>
                Adult: 13,500 (ticket 12,000 + service 1,500)<br />
                Child (3–11): 7,500 (ticket 6,000 + service 1,500)<br />
                Child (&lt;3): Free
              </div>
              <ul className="pricing-features">
                <li>Private luxury compartment</li>
                <li>Complimentary meals &amp; drinks</li>
                <li>Personal concierge service</li>
                <li>Best views through Tsavo</li>
              </ul>
              <button className="btn-book" onClick={() => setSelectedClass('premium')}>
                Select Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq" style={{ background: 'var(--rail-light)' }}>
        <div className="container">
          <div className="section-eyebrow">Common Questions</div>
          <h2 className="section-title">Frequently Asked</h2>
          <p className="section-sub">Everything you need to know before booking with us.</p>

          <div className="faq-list" style={{ maxWidth: 720 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <span className="faq-chevron">▾</span>
                </button>
                <div className="faq-answer" dangerouslySetInnerHTML={{ __html: faq.a }} />
              </div>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            More questions?{' '}
            <a href="https://metickets.krc.co.ke/faqs.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--savanna-dark)', textDecoration: 'underline' }}>
              View full official KRC FAQs →
            </a>
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="section" id="contact">
        <div className="container">
          <div className="section-eyebrow">Get in Touch</div>
          <h2 className="section-title">Need Help?</h2>
          <p className="section-sub">Custom itineraries, group bookings, or general questions — we&apos;re here.</p>

          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-card">
                <span className="contact-icon">📧</span>
                <div>
                  <div className="contact-label">Email</div>
                  <a href="mailto:safarirailbookings@gmail.com" className="contact-value">
                    safarirailbookings@gmail.com
                  </a>
                </div>
              </div>
              <div className="contact-card">
                <span className="contact-icon">📱</span>
                <div>
                  <div className="contact-label">WhatsApp</div>
                  <a href="https://wa.me/254769869503" target="_blank" rel="noopener noreferrer" className="contact-value">
                    +254 769 869 503
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
            SafariRail is an independent third-party booking agency. We are not affiliated with, endorsed by, or representing Kenya Railways Corporation (KRC). We assist tourists in booking Madaraka Express SGR tickets. The official KRC ticketing site is{' '}
            <a href="https://metickets.krc.co.ke" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>
              metickets.krc.co.ke
            </a>
            . Cancellations and refunds are handled directly by Kenya Railways at the station.
          </p>
        </div>
      </footer>

      {/* Booking Modal */}
      <BookingModal
        selectedClass={selectedClass}
        onClose={() => setSelectedClass(null)}
      />
    </>
  )
}
