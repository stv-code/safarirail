'use client'
import { useState, useEffect } from 'react'

const COUNTRIES = [
  'United Kingdom', 'United States', 'Germany', 'France', 'Netherlands',
  'Australia', 'Canada', 'Japan', 'China', 'India', 'South Africa',
  'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia', 'Other'
]

const CLASSES = {
  economy: {
    label: 'Economy',
    adultPrice: 2000,
    childPrice: 1250,
    service: 500,
  },
  first: {
    label: 'First Class',
    adultPrice: 5500,
    childPrice: 3250,
    service: 1000,
  },
  premium: {
    label: 'Premium',
    adultPrice: 13500,
    childPrice: 7500,
    service: 1500,
  },
}

type ClassKey = keyof typeof CLASSES
type Step = 'passenger' | 'payment' | 'success'

interface BookingModalProps {
  selectedClass: ClassKey | null
  onClose: () => void
}

export default function BookingModal({ selectedClass, onClose }: BookingModalProps) {
  const [step, setStep] = useState<Step>('passenger')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [form, setForm] = useState({
    name: '', passport: '', gender: '', country: '',
    date: '', time: 'morning', email: '',
    adults: 1, children: 0,
  })

  const cls = selectedClass ? CLASSES[selectedClass] : null
  const total = cls
    ? form.adults * cls.adultPrice + form.children * cls.childPrice
    : 0

  useEffect(() => {
    if (selectedClass) {
      setStep('passenger')
      setPaymentMethod('')
    }
  }, [selectedClass])

  useEffect(() => {
    document.body.style.overflow = selectedClass ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedClass])

  if (!selectedClass || !cls) return null

  const waMessage = encodeURIComponent(
    `Hi SafariRail,\n\nI have made a payment for the following booking:\n\nName: ${form.name}\nClass: ${cls.label}\nDate: ${form.date}\nPassengers: ${form.adults} adult(s), ${form.children} child(ren)\nTotal: KES ${total.toLocaleString()}\nPayment Method: ${paymentMethod}\n\nPlease confirm receipt. Thank you!`
  )

  const emailSubject = encodeURIComponent(`SafariRail Booking - ${cls.label} - ${form.name}`)
  const emailBody = encodeURIComponent(
    `Booking Details:\n\nName: ${form.name}\nPassport/ID: ${form.passport}\nClass: ${cls.label}\nDate: ${form.date}\nTime: ${form.time}\nPassengers: ${form.adults} adult(s), ${form.children} child(ren)\nTotal: KES ${total.toLocaleString()}\nPayment Method: ${paymentMethod}\nEmail: ${form.email}`
  )

  return (
    <div className={`modal-overlay${selectedClass ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">

        {step === 'passenger' && (
          <>
            <div className="modal-header">
              <div>
                <div className="modal-title">Passenger Details</div>
                <div className="modal-subtitle">Booking for: {cls.label}</div>
              </div>
              <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-total">
                <span className="modal-total-label">Estimated Total</span>
                <span className="modal-total-amount">KES {total.toLocaleString()}</span>
              </div>

              {/* Passengers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Adults</label>
                  <select
                    className="form-input"
                    value={form.adults}
                    onChange={e => setForm(f => ({ ...f, adults: Number(e.target.value) }))}
                  >
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Children (3–11)</label>
                  <select
                    className="form-input"
                    value={form.children}
                    onChange={e => setForm(f => ({ ...f, children: Number(e.target.value) }))}
                  >
                    {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name (as per Passport)</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Michael Smith"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Passport / ID Number</label>
                  <input
                    className="form-input"
                    type="text"
                    value={form.passport}
                    onChange={e => setForm(f => ({ ...f, passport: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={form.gender}
                    onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Country of Origin</label>
                <select
                  className="form-input"
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                >
                  <option value="">Select Country</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Travel Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Departure</label>
                  <select
                    className="form-input"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  >
                    <option value="morning">Morning (08:00)</option>
                    <option value="afternoon">Afternoon (15:00)</option>
                    <option value="night">Night (22:00)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="tickets@example.com"
                />
              </div>

              <div style={{ background: 'var(--rail-light)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--rail)', display: 'block', marginBottom: 4 }}>Children under 3 travel free.</strong>
                Ticket message sent to your email/WhatsApp after payment confirmation. You must print it at the station.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button
                className="btn-proceed"
                onClick={() => setStep('payment')}
                disabled={!form.name || !form.passport || !form.gender || !form.country || !form.date || !form.email}
                style={{ opacity: (!form.name || !form.passport || !form.gender || !form.country || !form.date || !form.email) ? 0.5 : 1 }}
              >
                Proceed to Payment →
              </button>
            </div>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="modal-header">
              <div>
                <div className="modal-title">Secure Payment</div>
                <div className="modal-subtitle">Choose your payment method</div>
              </div>
              <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-total">
                <div>
                  <div className="modal-total-label">Total Amount</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--savanna-dark)' }}>
                    {form.adults} adult{form.adults > 1 ? 's' : ''}{form.children > 0 ? ` + ${form.children} child${form.children > 1 ? 'ren' : ''}` : ''} · {cls.label}
                  </div>
                </div>
                <span className="modal-total-amount">KES {total.toLocaleString()}</span>
              </div>

              <div className="payment-methods">
                {[
                  { id: 'paypal', icon: '💳', label: 'PayPal', detail: 'safarirailbookings@gmail.com' },
                  { id: 'wise', icon: '🌍', label: 'Wise', detail: 'Transfer to M-Pesa · 0769 869 503' },
                  { id: 'remitly', icon: '💸', label: 'Remitly', detail: 'Transfer to M-Pesa · 0769 869 503' },
                  { id: 'sendwave', icon: '📱', label: 'Sendwave', detail: 'Transfer to M-Pesa · 0769 869 503' },
                  { id: 'western-union', icon: '🏦', label: 'Western Union', detail: 'Contact us for recipient details' },
                  { id: 'crypto', icon: '₿', label: 'Crypto (USDT/BTC/BNB)', detail: 'WhatsApp for wallet address' },
                ].map(m => (
                  <div
                    key={m.id}
                    className={`payment-method${paymentMethod === m.id ? ' selected' : ''}`}
                    onClick={() => setPaymentMethod(m.id)}
                  >
                    <span className="payment-method-icon">{m.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{m.label}</div>
                      <div style={{ fontSize: '0.76rem', marginTop: 2 }}>{m.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--rail-light)', padding: '10px 14px', borderRadius: 'var(--radius)', lineHeight: 1.6 }}>
                🔒 Make your payment first, then confirm below. Tickets are sent after payment is received. User is responsible for any transfer delays.
              </div>

              <div className="payment-actions">
                <a
                  href={`https://wa.me/254769869503?text=${waMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                  style={{ opacity: !paymentMethod ? 0.5 : 1, pointerEvents: !paymentMethod ? 'none' : 'auto' }}
                >
                  ✓ Confirm via WhatsApp
                </a>
                <a
                  href={`mailto:safarirailbookings@gmail.com?subject=${emailSubject}&body=${emailBody}`}
                  className="btn-email-confirm"
                  style={{ opacity: !paymentMethod ? 0.5 : 1, pointerEvents: !paymentMethod ? 'none' : 'auto' }}
                >
                  ✓ Confirm via Email
                </a>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setStep('passenger')}>← Back</button>
              <button
                className="btn-proceed"
                onClick={() => setStep('success')}
                disabled={!paymentMethod}
                style={{ opacity: !paymentMethod ? 0.5 : 1 }}
              >
                Mark as Paid ✓
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="success-modal">
            <div className="success-icon">✅</div>
            <div className="success-title">Booking Confirmed!</div>
            <p className="success-sub">
              Thank you, {form.name.split(' ')[0]}. We have received your payment notification. Your M-Pesa ticket message will be sent to your email/WhatsApp shortly.
            </p>

            <div className="ticket-preview">
              <div className="ticket-preview-label">SGR Ticket — Safari Rail</div>
              <div className="ticket-preview-row"><span>Class</span><strong>{cls.label}</strong></div>
              <div className="ticket-preview-row"><span>Date</span><strong>{form.date}</strong></div>
              <div className="ticket-preview-row"><span>Time</span><strong>{form.time === 'morning' ? '08:00' : form.time === 'afternoon' ? '15:00' : '22:00'}</strong></div>
              <div className="ticket-preview-row"><span>Passengers</span><strong>{form.adults}A {form.children > 0 ? `${form.children}C` : ''}</strong></div>
              <div className="ticket-preview-row"><span>Total Paid</span><strong>KES {total.toLocaleString()}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn-proceed"
                style={{ flex: 1 }}
                onClick={() => {
                  setStep('passenger')
                  setForm({ name: '', passport: '', gender: '', country: '', date: '', time: 'morning', email: '', adults: 1, children: 0 })
                  setPaymentMethod('')
                  onClose()
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
