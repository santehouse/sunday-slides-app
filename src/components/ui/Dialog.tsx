"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Accessible modal built on the native `<dialog>` element (Figma "Modal /
 * dialog shell"). `showModal()` gives us a real top-layer element, native
 * focus trapping and Escape-to-close for free, plus a real `aria-modal`.
 */
export function Dialog({ open, onClose, title, children, actions, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    // Fires on Escape (native) and on el.close() — keeps parent state in sync.
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Let the native close proceed; just make sure our state follows.
        event.currentTarget.addEventListener("close", () => onClose(), { once: true });
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-w-[480px] rounded-lg border border-border bg-surface p-6 cp-page-enter",
        "[&::backdrop]:bg-overlay",
        className,
      )}
    >
      <h2 id={titleId} className="text-h2 font-bold text-fg">
        {title}
      </h2>
      {children ? <div className="mt-3 text-label text-fg-secondary">{children}</div> : null}
      {actions ? <div className="mt-6 flex items-center justify-end gap-2.5">{actions}</div> : null}
    </dialog>
  );
}

export type ConfirmDialogDoubleConfirmStep = {
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: ReactNode;
};

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  confirmLoading?: boolean;
  /**
   * When set, the first confirm click swaps the dialog into this final step
   * (its own title/body/confirm label, always destructive-styled) instead of
   * calling `onConfirm` — only the final step's confirm click does that. The
   * step resets to the initial one whenever the dialog closes.
   */
  doubleConfirm?: ConfirmDialogDoubleConfirmStep;
};

/** A Dialog pre-wired with confirm/cancel actions, optionally destructive. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel,
  destructive = false,
  confirmLoading = false,
  doubleConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const [final, setFinal] = useState(false);

  const onFinalStep = Boolean(doubleConfirm) && final;

  // Reset back to the initial step on every close path (Cancel, backdrop click,
  // Escape, the native `close` event) so the dialog never reopens already on
  // the final "really do this" step.
  function handleClose() {
    setFinal(false);
    onClose();
  }

  function handleConfirmClick() {
    if (doubleConfirm && !final) {
      setFinal(true);
      return;
    }
    onConfirm();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={onFinalStep ? doubleConfirm!.title : title}
      actions={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={destructive || onFinalStep ? "danger" : "primary"}
            onClick={handleConfirmClick}
            loading={confirmLoading}
          >
            {onFinalStep ? doubleConfirm!.confirmLabel : (confirmLabel ?? t("confirm"))}
          </Button>
        </>
      }
    >
      {onFinalStep ? doubleConfirm!.children : children}
    </Dialog>
  );
}
