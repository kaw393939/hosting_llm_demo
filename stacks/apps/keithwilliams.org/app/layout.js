export const metadata = {
  title: 'keithwilliams.org — Blog',
  description: 'A minimal Next.js + Postgres blog on the single-server platform.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0b1020', color: '#e5e7eb' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 18px' }}>
          <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>keithwilliams.org</div>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Next.js + Postgres demo blog</div>
            </div>
            <nav style={{ display: 'flex', gap: 14, fontSize: 14 }}>
              <a href="/" style={{ color: '#e5e7eb' }}>Posts</a>
              <a href="/new" style={{ color: '#e5e7eb' }}>New</a>
            </nav>
          </header>
          <main style={{ marginTop: 22 }}>{children}</main>
          <footer style={{ marginTop: 34, opacity: 0.75, fontSize: 12 }}>
            Hosted on the single-server Traefik platform.
          </footer>
        </div>
      </body>
    </html>
  )
}
