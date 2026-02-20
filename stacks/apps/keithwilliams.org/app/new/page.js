import { createPost } from './actions'

export const dynamic = 'force-dynamic'

export default function NewPostPage({ searchParams }) {
  const error = searchParams?.error

  return (
    <div>
      <h1 style={{ margin: '0 0 14px 0' }}>New post</h1>
      {error ? (
        <div style={{ marginBottom: 12, color: '#fca5a5' }}>Title and body are required.</div>
      ) : null}

      <form action={createPost} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Title</span>
          <input
            name="title"
            placeholder="Hello world"
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(229,231,235,0.2)', background: 'rgba(255,255,255,0.03)', color: '#e5e7eb' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Body</span>
          <textarea
            name="body"
            rows={8}
            placeholder="Write something..."
            style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(229,231,235,0.2)', background: 'rgba(255,255,255,0.03)', color: '#e5e7eb' }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(229,231,235,0.2)',
            background: 'rgba(229,231,235,0.10)',
            color: '#e5e7eb',
            cursor: 'pointer',
            justifySelf: 'start',
          }}
        >
          Create
        </button>
      </form>
    </div>
  )
}
