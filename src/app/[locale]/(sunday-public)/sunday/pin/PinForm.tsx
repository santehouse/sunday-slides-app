"use client";

import { useActionState, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MessageState } from "@/components/ui/MessageState";
import { cn } from "@/lib/utils/cn";
import { submitPin, type PinFormState } from "./actions";

// Defined here (not imported from actions.ts) — a "use server" module may only export
// async functions, so a plain initial-state object has to live on the client side.
const initialPinFormState: PinFormState = { error: null };

const ERROR_MESSAGE_KEY: Record<NonNullable<PinFormState["error"]>, string> = {
  invalid: "invalid",
  rate_limited: "rateLimited",
  not_configured: "invalid",
  incomplete: "incomplete",
};

export function PinForm({ pinLength }: { pinLength: number }) {
  const t = useTranslations("pin");
  const [state, formAction, pending] = useActionState(submitPin, initialPinFormState);
  const [digits, setDigits] = useState<string[]>(() => Array(pinLength).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

  const pin = digits.join("");
  const complete = pin.length === pinLength && digits.every((d) => d !== "");

  function setDigitAt(index: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, "").slice(-1);
    setDigitAt(index, value);
    if (value && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigitAt(index - 1, "");
    }
    if (event.key === "Enter" && complete && !pending) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, pinLength);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(pinLength).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]!;
    setDigits(next);
    const focusIndex = Math.min(pasted.length, pinLength - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  const errorKey = state.error ? ERROR_MESSAGE_KEY[state.error] : null;

  return (
    <Card padding="none" className="w-full max-w-[460px] p-[34px]">
      <form ref={formRef} action={formAction} className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-h1 font-bold text-fg">{t("title")}</h1>
          <p className="text-label text-fg-secondary">{t("description", { digits: pinLength })}</p>
        </div>

        <div className="flex gap-3" role="group" aria-label={t("title")}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              aria-label={t("inputLabel", { index: index + 1 })}
              className={cn(
                "h-16 w-[72px] rounded-md border border-border bg-transparent text-center text-[24px] font-bold text-fg",
                "focus-visible:border-border-focus focus-visible:outline-none",
              )}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={pending}
            />
          ))}
        </div>

        {/* Hidden field carries the joined PIN to the server action. */}
        <input type="hidden" name="pin" value={pin} />

        {errorKey ? (
          <MessageState state="error" title={t("errorTitle")} message={t(errorKey)} className="w-full" />
        ) : null}

        <Button type="submit" variant="primary" disabled={!complete} loading={pending} className="w-full justify-center">
          {t("submit")}
        </Button>

        <Link href="/admin/sign-in" className="text-label text-fg-secondary underline-offset-2 hover:underline">
          {t("adminLink")}
        </Link>
      </form>
    </Card>
  );
}
