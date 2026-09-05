"use server";

import { randomUUID } from "node:crypto";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getDb } from "@/lib/data";
import { slugifyHeadline } from "@/lib/engines/slugFilename";

/** Creates a draft template (one headline field) and redirects straight to the Studio. */
export async function createTemplateAction(): Promise<void> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "admin.templates" });
  const db = getDb();

  const name = t("newTemplateName");
  const slug = `${slugifyHeadline(name)}-${randomUUID().slice(0, 8)}`;

  const template = await db.createTemplate({
    slug,
    nameEn: name,
    nameFr: name,
    category: "general",
    status: "draft",
  });

  await db.upsertTemplateFields(template.id, [
    {
      fieldKey: "headline",
      labelEn: "Headline",
      labelFr: "Titre",
      teamEditable: true,
      required: true,
      x: 96,
      y: 420,
      width: 1728,
      height: 240,
      fontFamily: "Arimo",
      fontSize: 96,
      minFontSize: 56,
      fontWeight: 700,
      fontStyle: "normal",
      lineHeight: 1.1,
      letterSpacing: 0,
      alignment: "left",
      textColor: "#ffffff",
      maxLines: 2,
      overflowMode: "auto_fit",
      textTransform: "uppercase",
      sortOrder: 0,
    },
  ]);

  revalidatePath("/admin/templates");
  redirect({ href: `/admin/templates/${template.id}`, locale });
}
