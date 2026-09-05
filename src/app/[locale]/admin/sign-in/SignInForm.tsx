"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MessageState } from "@/components/ui/MessageState";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { signInFormAction } from "./actions";
import { initialSignInFormState } from "./formState";

export function SignInForm() {
  const t = useTranslations("adminAuth");
  const [state, formAction, pending] = useActionState(signInFormAction, initialSignInFormState);

  if (state.mode === "magic_link_sent") {
    return (
      <Card padding="none" className="flex w-full max-w-[430px] flex-col gap-5 p-8">
        <MessageState
          state="success"
          title={t("magicLinkSent")}
          message={t("magicLinkSentBody", { email: state.email })}
        />
        <div className="flex justify-end">
          <LanguageSelector size="md" />
        </div>
      </Card>
    );
  }

  const showError = state.mode === "invalid_credentials" || state.mode === "magic_link_error";

  return (
    <Card padding="none" className="w-full max-w-[430px] p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="w-full">
          <h1 className="text-[26px] font-bold leading-8 text-fg">{t("title")}</h1>
          <p className="mt-2 text-[13px] text-fg-secondary">{t("helper")}</p>
        </div>

        {showError ? (
          <MessageState state="error" title={t("title")} message={t("invalidCredentials")} />
        ) : null}

        <Input id="admin-sign-in-email" name="email" type="email" required autoComplete="email" label={t("email")} />
        <Input
          id="admin-sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          label={t("password")}
        />

        <Button
          type="submit"
          name="intent"
          value="password"
          variant="primary"
          loading={pending}
        >
          {t("signIn")}
        </Button>

        <p className="flex h-6 items-center justify-center text-caption text-fg-secondary" aria-hidden="true">
          {t("or")}
        </p>

        <Button
          type="submit"
          name="intent"
          value="magic-link"
          variant="secondary"
          loading={pending}
        >
          {t("magicLink")}
        </Button>

        <div className="flex justify-start pt-2">
          <LanguageSelector size="md" />
        </div>
      </form>
    </Card>
  );
}
