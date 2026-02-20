import { ensureSchema, query } from '../../../lib/db'

export async function GET() {
  await ensureSchema()
  const result = await query(
    'SELECT id, title, body, created_at FROM posts ORDER BY created_at DESC LIMIT 50'
  )
  return Response.json({ posts: result.rows })
}
