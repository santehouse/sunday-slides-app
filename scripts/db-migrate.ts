/**
 * Applies supabase/migrations/*.sql to the linked Supabase project through the Management
 * API (the Postgres port is not reachable from every environment). Idempotent per file:
 * applied filenames are recorded in public.schema_migrations.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=ooeoyjosimxszebaydkj \
 *   pnpm tsx --tsconfig scripts/tsconfig.json scripts/db-migrate.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required");
  process.exit(1);
}

async function query(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  await query(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());`);
  const applied = new Set(
    ((await query(`select name from public.schema_migrations order by name`)) as { name: string }[]).map((r) => r.name),
  );
  const dir = path.resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file}`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`apply   ${file} … `);
    await query(`begin;\n${sql}\ninsert into public.schema_migrations(name) values ('${file}');\ncommit;`);
    console.log("ok");
  }
  const tables = (await query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`,
  )) as { table_name: string }[];
  console.log(`tables: ${tables.map((t) => t.table_name).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
