'use server'

import { redirect } from 'next/navigation'
import { ensureSchema, query } from '../../lib/db'

export async function createPost(formData) {
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()

  if (!title || !body) {
    redirect('/new?error=missing')
  }

  await ensureSchema()
  await query('INSERT INTO posts (title, body) VALUES ($1, $2)', [title, body])

  redirect('/')
}
