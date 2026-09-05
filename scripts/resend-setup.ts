/**
 * Registers the inbound/outbound email domain with Resend, prints the DNS records to add at
 * the registrar, and creates the inbound webhook for run sheets. Requires a FULL-ACCESS key.
 *
 *   RESEND_API_KEY=re_... RESEND_DOMAIN=sundaytomonday.church APP_URL=https://church-panels.vercel.app \
 *   pnpm tsx --tsconfig scripts/tsconfig.json scripts/resend-setup.ts
 */
const key = process.env.RESEND_API_KEY;
const domain = process.env.RESEND_DOMAIN ?? "sundaytomonday.church";
const appUrl = process.env.APP_URL ?? "https://church-panels.vercel.app";
if (!key) {
  console.error("RESEND_API_KEY is required");
  process.exit(1);
}

async function api(method: string, pathName: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.resend.com${pathName}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${pathName}: ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function main() {
  const list = await api("GET", "/domains");
  let existing = (list.data ?? []).find((d: { name: string }) => d.name === domain);
  if (!existing) {
    existing = await api("POST", "/domains", { name: domain, region: "us-east-1" });
    console.log(`created domain ${domain}`);
  }
  const detail = await api("GET", `/domains/${existing.id}`);
  console.log(`\nDomain ${domain} — status: ${detail.status}\nAdd these DNS records at the registrar:\n`);
  for (const r of detail.records ?? []) {
    console.log(`  ${r.record.padEnd(5)} ${r.type.padEnd(5)} name=${r.name}  value=${r.value}${r.priority ? `  priority=${r.priority}` : ""}  ttl=${r.ttl ?? "auto"}`);
  }
  console.log(`\nInbound MX (receiving): ensure an MX record for ${domain} points at Resend's inbound host as shown above.`);

  const hooks = await api("GET", "/webhooks");
  const endpoint = `${appUrl}/api/inbound/resend`;
  let hook = (hooks.data ?? []).find((h: { endpoint: string }) => h.endpoint === endpoint);
  if (!hook) {
    hook = await api("POST", "/webhooks", { endpoint, events: ["email.received"] });
    console.log(`\ncreated webhook ${endpoint}`);
  } else {
    console.log(`\nwebhook already exists: ${endpoint}`);
  }
  if (hook.signing_secret) console.log(`RESEND_INBOUND_WEBHOOK_SECRET=${hook.signing_secret}`);
  else console.log("Copy the webhook signing secret from the Resend dashboard into RESEND_INBOUND_WEBHOOK_SECRET.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
