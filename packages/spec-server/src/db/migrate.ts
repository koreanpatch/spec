import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

async function migrate() {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set in environment");
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    process.stdout.write("Connected to database\n");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        executed_at timestamptz DEFAULT now()
      )
    `);

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    const executed = new Set(rows.map((r: { version: string }) => r.version));

    const files = await readdir(migrationsDir);
    const migrations = files.filter((f) => f.endsWith(".sql")).sort();

    if (migrations.length === 0) {
      process.stdout.write("No migrations found\n");
      return;
    }

    let ranCount = 0;
    for (const file of migrations) {
      if (executed.has(file)) {
        process.stdout.write(`-- ${file} (already executed)\n`);
        continue;
      }

      process.stdout.write(`Running ${file}...\n`);
      const sql = await readFile(join(migrationsDir, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        process.stdout.write(`  ${file} done\n`);
        ranCount++;
      } catch (error) {
        await client.query("ROLLBACK");
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`  ${file} failed: ${message}\n`);
        throw error;
      }
    }

    if (ranCount === 0) {
      process.stdout.write("All migrations up to date\n");
    } else {
      process.stdout.write(`${ranCount} migration(s) completed\n`);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  process.stderr.write(`Migration failed: ${err}\n`);
  process.exit(1);
});
