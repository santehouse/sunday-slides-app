import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { VisuallyHidden } from "./VisuallyHidden";

export type SpinnerProps = {
  size?: number;
  className?: string;
  /** Accessible label announced to screen readers while the spinner is visible. */
  label?: string;
};

/** A spinning Lucide loader. Purely visual — pass `label` for an accessible name. */
export function Spinner({ size = 20, className, label }: SpinnerProps) {
  return (
    <>
      <Loader2 aria-hidden="true" size={size} className={cn("animate-spin", className)} />
      {label ? <VisuallyHidden>{label}</VisuallyHidden> : null}
    </>
  );
}
