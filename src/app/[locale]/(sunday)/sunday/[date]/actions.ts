"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/data";

const MIN_SECONDS = 1;
const MAX_SECONDS = 30;

/** Updates the Sunday's global default slide hold (Duration Stepper, clamped 1–30s). */
export async function updateHoldSecondsAction(sundayId: string, seconds: number): Promise<number> {
  const clamped = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(seconds)));
  const sunday = await getDb().updateSunday(sundayId, { defaultSlideHoldSeconds: clamped });
  revalidatePath(`/sunday/${sunday.serviceDate}`);
  revalidatePath(`/sunday/${sunday.serviceDate}/flow`);
  return sunday.defaultSlideHoldSeconds;
}
