import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

export { pool }

export const query = (text: string, params?: readonly unknown[]) => pool.query(text, params)
