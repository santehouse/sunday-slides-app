import type { ReactNode } from "react";

/**
 * Renders children for screen readers only. Use for accessible names that
 * shouldn't take up visual space (e.g. announcing state changes).
 */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
