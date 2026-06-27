export const dynamic = 'force-dynamic'
import Nav from '@/components/Nav'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Traveller Reviews | SafariRail',
  description: 'See what tourists say about SafariRail SGR booking assistance for the Madaraka Express.',
}

const REVIEWS = [
  {
    stars: 5,
    title: 'Lifesaver for tourists!',
    text: 'I tried booking on the official site but could not use my Visa card. Steve helped me get the tickets via PayPal within an hour. Highly recommend!',
    author: 'Sarah J., UK',
  },
  {
    stars: 5,
    title: 'Smooth process',
    text: 'Sent funds via Wise and got my M-Pesa ticket message shortly after. Printed it at the station with no issues. The Nairobi to Mombasa journey was stunning.',
    author: 'Michael T., Germany',
  },
]

export default function ReviewsPage() {
  return (
    <>
      <Nav />

      <section style={{ background: 'var(--rail)', padding: '56px 0', color: 'var(--white)' }}>
        <div className="container">
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--savanna)', marginBottom: 10 }}>
            Social Proof
          </div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: 'var(--white)', marginBottom: 12 }}>
            Traveller Reviews
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 500, lineHeight: 1.7 }}>
            See what others are saying about our booking assistance service.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-eyebrow">Recent Feedback</div>
          <h2 className="section-title" style={{ marginBottom: 32 }}>What Travellers Say</h2>

          <div className="reviews-grid" style={{ maxWidth: 800 }}>
            {REVIEWS.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-stars">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                <div className="review-title">{r.title}</div>
                <p className="review-text">&ldquo;{r.text}&rdquo;</p>
                <div className="review-author">— {r.author}</div>
              </div>
            ))}
          </div>

          {/* Leave a review form */}
          <div style={{ maxWidth: 560, marginTop: 48 }}>
            <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.4rem', color: 'var(--rail)', marginBottom: 6 }}>Leave a Review</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>Your review will be checked before going live.</p>

            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              onSubmit={e => { e.preventDefault(); alert('Thank you! Your review has been submitted for approval.') }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                {[5, 4, 3].map(n => (
                  <label key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <input type="radio" name="rating" value={n} required />
                    {'★'.repeat(n)} {n === 5 ? 'Excellent' : n === 4 ? 'Good' : 'Average'}
                  </label>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Your Name &amp; Country</label>
                <input className="form-input" type="text" placeholder="e.g. James W., France" required />
              </div>
              <div className="form-group">
                <label className="form-label">Review Title</label>
                <input className="form-input" type="text" placeholder="e.g. Great service!" required />
              </div>
              <div className="form-group">
                <label className="form-label">Your Experience</label>
                <textarea className="form-textarea" placeholder="Tell us about your booking experience..." required />
              </div>
              <button type="submit" className="btn-send" style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
                Submit Review
              </button>
            </form>
          </div>

          <p style={{ marginTop: 48, fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--rail-light)', padding: '12px 16px', borderRadius: 'var(--radius)', maxWidth: 600 }}>
            ⚠️ Disclaimer: SafariRail is a third-party booking agency. We do not sell tickets but assist in booking them from the official Kenya Railways Corporation.
          </p>

          <div style={{ marginTop: 32 }}>
            <Link href="/" style={{ color: 'var(--savanna-dark)', fontWeight: 600, textDecoration: 'underline' }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-logo">Safari<span>Rail</span></div>
            <nav className="footer-links">
              <Link href="/#pricing">Classes</Link>
              <Link href="/reviews">Reviews</Link>
              <Link href="/#faq">FAQ</Link>
              <Link href="/#contact">Contact</Link>
            </nav>
          </div>
          <p className="footer-disclaimer">
            SafariRail is an independent third-party booking agency. Not affiliated with Kenya Railways Corporation.
          </p>
        </div>
      </footer>
    </>
  )
}
