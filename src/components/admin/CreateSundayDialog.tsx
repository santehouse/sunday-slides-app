"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSundayAction } from "@/app/[locale]/admin/(protected)/sundays/actions";
import { initialCreateSundayState, type CreateSundayState } from "@/app/[locale]/admin/(protected)/sundays/formState";

/** Self-contained "Create Sunday" primary button + dialog, used by both the Dashboard and Sundays list. */
export function CreateSundayDialog() {
  const t = useTranslations("admin.sundays");
  const tDash = useTranslations("admin.dashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState("");
  const [state, setState] = useState<CreateSundayState>(initialCreateSundayState);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const formData = new FormData();
    formData.set("serviceDate", serviceDate);
    startTransition(async () => {
      const result = await createSundayAction(initialCreateSundayState, formData);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        router.push(`/admin/sundays/${result.id}`);
      }
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        {tDash("createSunday")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("createTitle")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" loading={isPending} onClick={handleCreate}>
              {tCommon("continue")}
            </Button>
          </>
        }
      >
        <Input
          id="create-sunday-date"
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          label={t("serviceDate")}
          required
          error={state.status === "error" && state.error === "date_exists" ? t("dateExists") : undefined}
        />
      </Dialog>
    </>
  );
}
