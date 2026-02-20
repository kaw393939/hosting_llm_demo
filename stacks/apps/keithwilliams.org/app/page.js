import { ensureSchema, query } from '../lib/db'

export const dynamic = 'force-dynamic'

async function getPosts() {
  await ensureSchema()
  const result = await query(
    'SELECT id, title, body, created_at FROM posts ORDER BY created_at DESC LIMIT 50'
  )
  return result.rows
}

export default async function Page() {
  const posts = await getPosts()

  return (
    <div>
      <h1 style={{ margin: '0 0 14px 0' }}>Posts</h1>
      {posts.length === 0 ? (
        <div style={{ opacity: 0.85 }}>No posts yet. Create one from <a href="/new" style={{ color: '#e5e7eb' }}>/new</a>.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {posts.map((p) => (
            <article
              key={p.id}
              style={{
                border: '1px solid rgba(229,231,235,0.15)',
                borderRadius: 12,
                padding: 14,
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>{p.title}</h2>
                <time style={{ opacity: 0.75, fontSize: 12 }}>
                  {new Date(p.created_at).toLocaleString()}
                </time>
              </div>
              <p style={{ margin: '10px 0 0 0', whiteSpace: 'pre-wrap', opacity: 0.92 }}>{p.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
