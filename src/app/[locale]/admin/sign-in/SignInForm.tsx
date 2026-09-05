"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { initialSignInFormState, signInFormAction } from "./actions";

export function SignInForm() {
  const t = useTranslations("adminAuth");
  const [state, formAction, pending] = useActionState(signInFormAction, initialSignInFormState);

  if (state.mode === "magic_link_sent") {
    return (
      // TODO(ui-kit): swap to <MessageState variant="success"> once src/components/ui/MessageState exists
      <div className="w-full max-w-[430px] rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-bold">{t("magicLinkSent")}</h1>
        <p className="mt-2 text-sm text-fg-secondary">{t("magicLinkSentBody", { email: state.email })}</p>
      </div>
    );
  }

  const showError = state.mode === "invalid_credentials" || state.mode === "magic_link_error";

  return (
    <form
      action={formAction}
      className="flex w-full max-w-[430px] flex-col gap-5 rounded-lg border border-border bg-surface p-8"
    >
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t("helper")}</p>
      </div>

      {showError ? (
        // TODO(ui-kit): swap to <MessageState variant="error"> once src/components/ui/MessageState exists
        <p role="alert" className="text-sm text-[var(--status-error-text)]">
          {t("invalidCredentials")}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">{t("email")}</span>
        {/* TODO(ui-kit): swap to <Input> once src/components/ui/Input exists */}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-border bg-transparent px-3"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">{t("password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-10 rounded-md border border-border bg-transparent px-3"
        />
      </label>

      {/* TODO(ui-kit): swap to <Button> once src/components/ui/Button exists */}
      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        className="h-10 rounded-md bg-[var(--bg-primary)] text-sm font-bold text-[var(--text-on-primary)] disabled:opacity-50"
      >
        {t("signIn")}
      </button>

      <div className="flex items-center gap-3 text-xs text-fg-secondary" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="submit"
        name="intent"
        value="magic-link"
        disabled={pending}
        className="h-10 rounded-md border border-border text-sm font-bold disabled:opacity-50"
      >
        {t("magicLink")}
      </button>

      {/* TODO(ui-kit): swap to <LanguageSelector /> once src/components/ui/LanguageSelector exists */}
    </form>
  );
}
