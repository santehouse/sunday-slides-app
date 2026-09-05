"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import {
  inviteAdminAction,
  reprocessLastRunSheetAction,
  rotatePinAction,
  saveSettingsAction,
  setAdminDisabledAction,
} from "./actions";
import type { AdminUser, AppSettings, Locale } from "@/lib/domain/types";

const TIMEZONE_OPTIONS = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Halifax",
  "America/Edmonton",
  "Europe/Paris",
  "Europe/London",
  "UTC",
];

function InviteAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("common");
  const { showToast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    if (!email) return;
    startTransition(async () => {
      const result = await inviteAdminAction(email);
      if (result.ok) {
        showToast({ state: "success", title: t("inviteAdmin"), message: t("inviteSent", { email }) });
        setEmail("");
        onClose();
        router.refresh();
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("inviteAdmin")}>
      <div className="flex flex-col gap-4">
        <Input id="invite-admin-email" type="email" label={t("inviteEmail")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button variant="primary" loading={isPending} disabled={!email} onClick={handleInvite}>
            {t("inviteAdmin")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function SettingsClient({
  settings,
  admins,
  currentAdminId,
  hasWebhookSecret,
  openaiModel,
}: {
  settings: AppSettings;
  admins: AdminUser[];
  currentAdminId: string | null;
  hasWebhookSecret: boolean;
  openaiModel: string;
}) {
  const t = useTranslations("admin.settings");
  const tCommon = useTranslations("common");
  const tLanguage = useTranslations("language");
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPinPending, startPinTransition] = useTransition();
  const [isReprocessPending, startReprocessTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);

  const [churchName, setChurchName] = useState(settings.churchName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [defaultLocale, setDefaultLocale] = useState<Locale>(settings.defaultLocale);
  const [defaultSlideHoldSeconds, setDefaultSlideHoldSeconds] = useState(settings.defaultSlideHoldSeconds);
  const [inboundEmail, setInboundEmail] = useState(settings.inboundEmail ?? "");
  const [autoProcessInbound, setAutoProcessInbound] = useState(settings.autoProcessInbound);
  const [safeZone, setSafeZone] = useState(settings.safeZone);
  const [retentionDays, setRetentionDays] = useState(settings.temporaryRetentionDays);
  const [pin, setPin] = useState("");

  const pipInvalid =
    safeZone.x < 0 ||
    safeZone.y < 0 ||
    safeZone.width <= 0 ||
    safeZone.height <= 0 ||
    safeZone.x + safeZone.width > 1920 ||
    safeZone.y + safeZone.height > 1080;

  function handleSave() {
    startTransition(async () => {
      await saveSettingsAction({
        churchName,
        timezone,
        defaultLocale,
        defaultSlideHoldSeconds,
        inboundEmail: inboundEmail || null,
        autoProcessInbound,
        safeZone,
        temporaryRetentionDays: retentionDays,
      });
      showToast({ state: "success", title: t("saved"), message: churchName });
      router.refresh();
    });
  }

  function handleRotatePin() {
    startPinTransition(async () => {
      const result = await rotatePinAction(pin);
      if (result.ok) {
        showToast({ state: "success", title: t("pinUpdated"), message: t("sundayPinHelper", { digits: pin.length }) });
        setPin("");
        router.refresh();
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: tCommon("required") });
      }
    });
  }

  function handleReprocessLast() {
    startReprocessTransition(async () => {
      const result = await reprocessLastRunSheetAction();
      showToast(
        result.ok
          ? { state: "success", title: t("reprocessLast"), message: tCommon("ready") }
          : { state: "error", title: tCommon("failed"), message: tCommon("failed") },
      );
      router.refresh();
    });
  }

  function handleToggleAdmin(admin: AdminUser) {
    startTransition(async () => {
      const result = await setAdminDisabledAction(admin.id, !admin.disabledAt);
      if (result.ok) {
        router.refresh();
      } else {
        showToast({ state: "error", title: tCommon("failed"), message: t("cannotDisableSelf") });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="mt-1.5 text-caption text-fg-secondary">{t("subtitle")}</p>
        </div>
        <Button variant="primary" loading={isPending} onClick={handleSave}>
          {tCommon("saveChanges")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader title={t("churchAndSunday")} />
          <p className="text-caption text-fg-secondary">{t("churchAndSundayHelper")}</p>
          <Input id="settings-church-name" label={t("churchName")} value={churchName} onChange={(e) => setChurchName(e.target.value)} />
          <Select
            id="settings-timezone"
            label={t("timezone")}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz }))}
          />
          <Select
            id="settings-default-locale"
            label={t("defaultLocale")}
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value as Locale)}
            options={[
              { value: "en", label: tLanguage("englishName") },
              { value: "fr-CA", label: tLanguage("frenchName") },
            ]}
          />
          <Input
            id="settings-default-duration"
            type="number"
            min={1}
            max={30}
            label={t("defaultSlideDuration")}
            value={defaultSlideHoldSeconds}
            onChange={(e) => setDefaultSlideHoldSeconds(Number(e.target.value))}
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader title={t("intake")} />
          <p className="text-caption text-fg-secondary">{t("intakeHelper")}</p>
          <Input
            id="settings-inbound-email"
            type="email"
            label={t("inboundEmail")}
            value={inboundEmail}
            onChange={(e) => setInboundEmail(e.target.value)}
          />
          <Input
            id="settings-webhook-secret"
            label={t("webhookSecret")}
            value={hasWebhookSecret ? t("configured") : t("notConfigured")}
            readOnly
            disabled
          />
          <Toggle checked={autoProcessInbound} onChange={setAutoProcessInbound} label={t("autoProcess")} />
          <Input id="settings-openai-model" label={t("openaiModel")} value={openaiModel} readOnly disabled />
          <div>
            <Button variant="secondary" loading={isReprocessPending} onClick={handleReprocessLast}>
              {t("reprocessLast")}
            </Button>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader title={t("broadcast")} />
          <p className="text-caption text-fg-secondary">{t("broadcastHelper")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="settings-pip-x"
              type="number"
              label={t("pipX")}
              value={safeZone.x}
              onChange={(e) => setSafeZone({ ...safeZone, x: Number(e.target.value) })}
            />
            <Input
              id="settings-pip-y"
              type="number"
              label={t("pipY")}
              value={safeZone.y}
              onChange={(e) => setSafeZone({ ...safeZone, y: Number(e.target.value) })}
            />
            <Input
              id="settings-pip-width"
              type="number"
              label={t("pipWidth")}
              value={safeZone.width}
              onChange={(e) => setSafeZone({ ...safeZone, width: Number(e.target.value) })}
            />
            <Input
              id="settings-pip-height"
              type="number"
              label={t("pipHeight")}
              value={safeZone.height}
              onChange={(e) => setSafeZone({ ...safeZone, height: Number(e.target.value) })}
              error={pipInvalid ? "1920×1080" : undefined}
            />
          </div>
          <Input
            id="settings-retention-days"
            type="number"
            min={1}
            label={t("retentionDays")}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader title={t("access")} />
          <p className="text-caption text-fg-secondary">{t("accessHelper")}</p>
          <div className="flex items-end gap-3">
            <Input
              id="settings-sunday-pin"
              inputMode="numeric"
              label={t("sundayPin")}
              helper={t("sundayPinHelper", { digits: settings.sundayPinLength })}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              containerClassName="flex-1"
            />
            <Button
              variant="secondary"
              loading={isPinPending}
              disabled={pin.length < 4}
              onClick={handleRotatePin}
            >
              {t("rotatePin")}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-caption font-bold text-fg-secondary">{t("administrators")}</span>
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-label font-bold text-fg">{admin.displayName}</p>
                  <p className="truncate text-caption text-fg-secondary">{admin.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={admin.disabledAt ? "archived" : "active"} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={admin.id === currentAdminId && !admin.disabledAt}
                    onClick={() => handleToggleAdmin(admin)}
                  >
                    {admin.disabledAt ? t("enableAdmin") : t("disableAdmin")}
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button variant="secondary" onClick={() => setInviteOpen(true)}>
                {t("inviteAdmin")}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <InviteAdminDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
