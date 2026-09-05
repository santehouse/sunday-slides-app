"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
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
        "m-auto max-w-[480px] rounded-lg border border-border bg-surface p-6",
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
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={confirmLoading}
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
