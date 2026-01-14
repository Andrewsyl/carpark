import "./loadEnv.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query(`SELECT filename FROM schema_migrations ORDER BY filename`);
  return new Set(result.rows.map((row) => row.filename as string));
}

async function runMigration(filename: string, sql: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
    await client.query("COMMIT");
    console.log(`Applied ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await runMigration(file, sql);
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
