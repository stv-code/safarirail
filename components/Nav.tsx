'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const navLinksId = 'primary-navigation'

  return (
    <nav className="nav">
      <div className="container nav-inner" style={{ position: 'relative' }}>
        <Link href="/" className="nav-logo">
          Safari<span>Rail</span>
        </Link>

        <ul id={navLinksId} className={`nav-links${open ? ' open' : ''}`}>
          <li><a href="/#pricing" onClick={() => setOpen(false)}>Classes</a></li>
          <li><Link href="/reviews" onClick={() => setOpen(false)}>Reviews</Link></li>
          <li><a href="/#faq" onClick={() => setOpen(false)}>FAQ</a></li>
          <li><a href="/#contact" onClick={() => setOpen(false)}>Contact</a></li>
          <li>
            <a href="/#pricing" className="nav-cta" onClick={() => setOpen(false)}>
              Book Now
            </a>
          </li>
        </ul>

        <button
          className="nav-hamburger"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls={navLinksId}
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
