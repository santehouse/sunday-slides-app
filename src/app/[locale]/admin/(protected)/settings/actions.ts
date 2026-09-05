"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";
import { getAdminSession } from "@/lib/auth/admin-session";
import { hasSupabase, isMockMode } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/service";
import { getRunSheetIntake } from "@/components/admin/runSheetIntake";
import type { AdminUser } from "@/lib/domain/types";
import type { UpdateSettingsPatch } from "@/lib/data";

function revalidateSettings() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}

export async function saveSettingsAction(patch: UpdateSettingsPatch): Promise<{ ok: boolean }> {
  const db = getDb();
  await db.updateSettings(patch);
  revalidateSettings();
  return { ok: true };
}

export type RotatePinResult = { ok: true } | { ok: false; error: string };

export async function rotatePinAction(pin: string): Promise<RotatePinResult> {
  if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: "invalid" };
  const db = getDb();
  const hash = await bcrypt.hash(pin, 10);
  await db.setSundayPin(hash, pin.length);
  revalidateSettings();
  return { ok: true };
}

export async function reprocessLastRunSheetAction(): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const todayIso = new Date().toISOString().slice(0, 10);
  const sunday = await db.getNextSunday(todayIso, { create: false });
  if (!sunday) return { ok: false, error: "no_sunday" };
  const latest = await db.getLatestRunSheetForSunday(sunday.id);
  if (!latest) return { ok: false, error: "no_run_sheet" };

  const { reprocessRunSheet } = getRunSheetIntake();
  try {
    await reprocessRunSheet(latest.id);
    revalidateSettings();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}

export type SetAdminDisabledResult = { ok: true; admin: AdminUser } | { ok: false; error: "self" };

export async function setAdminDisabledAction(id: string, disabled: boolean): Promise<SetAdminDisabledResult> {
  const session = await getAdminSession();
  if (session && session.adminUser.id === id && disabled) {
    return { ok: false, error: "self" };
  }
  const db = getDb();
  const admin = await db.setAdminDisabled(id, disabled ? new Date().toISOString() : null);
  revalidateSettings();
  return { ok: true, admin };
}

export type InviteAdminResult = { ok: true; admin: AdminUser } | { ok: false; error: string };

export async function inviteAdminAction(email: string): Promise<InviteAdminResult> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "invalid" };
  const db = getDb();

  try {
    if (isMockMode() || !hasSupabase()) {
      const admin = await db.upsertAdminUser({
        authUserId: `mock-auth-${trimmed}`,
        email: trimmed,
        displayName: trimmed.split("@")[0] ?? trimmed,
        role: "admin",
        locale: "en",
      });
      revalidateSettings();
      return { ok: true, admin };
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(trimmed);
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "invite_failed" };
    }
    const admin = await db.upsertAdminUser({
      authUserId: data.user.id,
      email: trimmed,
      displayName: trimmed.split("@")[0] ?? trimmed,
      role: "admin",
      locale: "en",
    });
    revalidateSettings();
    return { ok: true, admin };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown" };
  }
}
