import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"],
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  process.stderr.write(`Unexpected pool error: ${err.message}\n`);
});

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, values);
}

export async function runMigration(sql: string): Promise<void> {
  await pool.query(sql);
}

export async function shutdown(): Promise<void> {
  await pool.end();
}
