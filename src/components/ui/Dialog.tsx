"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

export type DialogSize = "md" | "lg";

const SIZE_CLASSES: Record<DialogSize, string> = {
  md: "max-w-[480px]",
  // Near-full-screen: the simplified Sunday IA's Import / New slide / Edit modals
  // (Figma "Modal shell — large"). Scrolls internally rather than the page behind it.
  lg: "max-w-[1100px] w-[calc(100vw-64px)] max-h-[85vh] flex flex-col overflow-hidden",
};

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  size?: DialogSize;
  /** Renders `children` directly against the dialog's own scroll container instead of
      inside the default `mt-3 text-label text-fg-secondary` wrapper — used by `size="lg"`
      screens that own their own two-column/scrolling layout. */
  bareBody?: boolean;
};

/**
 * Accessible modal built on the native `<dialog>` element (Figma "Modal /
 * dialog shell"). `showModal()` gives us a real top-layer element, native
 * focus trapping and Escape-to-close for free, plus a real `aria-modal`.
 */
export function Dialog({ open, onClose, title, children, actions, className, size = "md", bareBody = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // No dependency array: syncs the native element's open state after *every* render, not
  // only when the `open` prop itself changes. That matters for a guarded close (a caller
  // that intercepts Escape/backdrop-close to ask "discard changes?" first) — the browser
  // already closed the native `<dialog>` by the time our `onClose` runs, and since the
  // caller's own re-render (e.g. opening its confirm dialog) doesn't necessarily change
  // this `open` prop, only an every-render sync reliably re-opens it while `open` is
  // still true. The guards make repeat calls safe (`showModal()`/`close()` on an
  // already-open/closed dialog are no-ops here, not thrown errors).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  });

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
        "m-auto rounded-lg border border-border bg-surface p-6 cp-page-enter",
        "[&::backdrop]:bg-overlay",
        SIZE_CLASSES[size],
        className,
      )}
    >
      <h2 id={titleId} className="shrink-0 text-h2 font-bold text-fg">
        {title}
      </h2>
      {children ? (
        bareBody ? (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{children}</div>
        ) : (
          <div className="mt-3 text-label text-fg-secondary">{children}</div>
        )
      ) : null}
      {actions ? <div className="mt-6 flex shrink-0 items-center justify-end gap-2.5">{actions}</div> : null}
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
