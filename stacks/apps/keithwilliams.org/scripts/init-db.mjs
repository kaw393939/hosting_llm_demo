import { Client } from 'pg'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function connectWithRetry() {
  const password = process.env.POSTGRES_PASSWORD
  let lastError

  for (let i = 0; i < 30; i++) {
    const client = new Client({
      host: process.env.PGHOST ?? 'postgres',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'app',
      user: process.env.PGUSER ?? 'app',
      password,
    })

    try {
      await client.connect()
      return client
    } catch (error) {
      lastError = error
      try {
        await client.end()
      } catch {
        // ignore
      }
      await sleep(1000)
    }
  }

  throw lastError
}

const client = await connectWithRetry()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  const count = await client.query('SELECT COUNT(*)::int AS n FROM posts')
  if (count.rows?.[0]?.n === 0) {
    await client.query('INSERT INTO posts (title, body) VALUES ($1, $2)', [
      'Welcome',
      'This is a minimal blog backed by Postgres. Create a new post at /new.',
    ])
  }
} finally {
  await client.end()
}
