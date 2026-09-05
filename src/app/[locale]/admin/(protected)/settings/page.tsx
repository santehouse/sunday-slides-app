import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/data";
import { getAdminSession } from "@/lib/auth/admin-session";
import { env } from "@/lib/env";
import { SettingsClient } from "./SettingsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.settings" });
  return { title: t("title") };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const db = getDb();
  const [settings, admins, session] = await Promise.all([
    db.getSettings(),
    db.listAdminUsers(),
    getAdminSession(),
  ]);

  return (
    <SettingsClient
      settings={settings}
      admins={admins}
      currentAdminId={session?.adminUser.id ?? null}
      hasWebhookSecret={Boolean(env.RESEND_INBOUND_WEBHOOK_SECRET)}
      openaiModel={env.OPENAI_MODEL}
    />
  );
}
