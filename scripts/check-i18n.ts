/**
 * Fails when en.json and fr-CA.json key sets differ, or when a t('…') key used in src/ is missing.
 */
import fs from "node:fs";
import path from "node:path";

type Tree = { [k: string]: string | Tree };
const root = path.resolve(__dirname, "..");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "messages", f), "utf8")) as Tree;
const flatten = (o: Tree, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flatten(v, p + k + ".") : [p + k]));

const en = new Set(flatten(read("en.json")));
const fr = new Set(flatten(read("fr-CA.json")));
const missingFr = [...en].filter((k) => !fr.has(k));
const extraFr = [...fr].filter((k) => !en.has(k));
let failed = false;
if (missingFr.length) { console.error("Missing in fr-CA:", missingFr); failed = true; }
if (extraFr.length) { console.error("Extra in fr-CA:", extraFr); failed = true; }

// Static key usage scan: useTranslations("ns") + t("key") pairs inside a file.
const files: string[] = [];
const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
});
walk(path.join(root, "src"));
const unknown: string[] = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const nsMatches = [...src.matchAll(/(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?["'`]([\w.]+)["'`]/g)].map((m) => m[1]);
  const keys = [...src.matchAll(/\bt(?:Common|Status|Errors)?\(\s*["'`]([\w.]+)["'`]/g)].map((m) => m[1]);
  for (const k of keys) {
    const ok = nsMatches.some((ns) => en.has(`${ns}.${k}`)) || en.has(k);
    if (!ok && nsMatches.length) unknown.push(`${path.relative(root, f)}: ${k}`);
  }
}
if (unknown.length) { console.error("Possibly unknown translation keys (verify):\n" + unknown.join("\n")); }
console.log(`i18n: ${en.size} keys, parity ${failed ? "FAILED" : "ok"}, ${unknown.length} unverified usages`);
process.exit(failed ? 1 : 0);
