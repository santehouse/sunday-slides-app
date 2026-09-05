"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { MessageState, type MessageStateKind } from "./MessageState";

export type ToastInput = {
  state: MessageStateKind;
  title: ReactNode;
  message: ReactNode;
  /** Milliseconds before auto-dismiss. Defaults to 5000. */
  duration?: number;
};

type ToastEntry = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

/** Minimal bottom-right toast stack, styled with MessageState. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.duration ?? DEFAULT_DURATION);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto relative">
            <MessageState state={toast.state} title={toast.title} message={toast.message} />
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => dismiss(toast.id)}
              className="absolute right-2 top-2 rounded-sm p-0.5 text-fg-secondary hover:bg-black/5"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
