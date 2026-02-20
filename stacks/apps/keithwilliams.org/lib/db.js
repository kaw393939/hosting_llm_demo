import fs from 'node:fs'
import { Pool } from 'pg'

function getPassword() {
  if (process.env.POSTGRES_PASSWORD) return process.env.POSTGRES_PASSWORD
  if (process.env.POSTGRES_PASSWORD_FILE) {
    return fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE, 'utf8').trim()
  }
  return undefined
}

const pool = new Pool({
  host: process.env.PGHOST ?? 'postgres',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'app',
  user: process.env.PGUSER ?? 'app',
  password: getPassword(),
  max: 5,
  idleTimeoutMillis: 30_000,
})

export async function query(text, params) {
  return pool.query(text, params)
}

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}
