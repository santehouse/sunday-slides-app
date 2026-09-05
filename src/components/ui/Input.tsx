import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  adornment?: ReactNode;
  containerClassName?: string;
};

/**
 * Figma "Input" master (node 3:66). Field background is transparent —
 * inputs are surface-integrated, never a white fill inside a white card.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, helper, error, adornment, className, containerClassName, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const hasHelper = Boolean(helper || error);

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label ? (
        <label htmlFor={inputId} className="text-caption font-bold text-fg-secondary">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-md border bg-transparent px-3 text-label text-fg placeholder:text-fg-muted",
            "focus-visible:border-border-focus",
            error ? "border-error-fg" : "border-border",
            adornment ? "pr-9" : undefined,
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasHelper ? helperId : undefined}
          {...rest}
        />
        {adornment ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-fg-muted">
            {adornment}
          </span>
        ) : null}
      </div>
      {hasHelper ? (
        <p id={helperId} className={cn("text-caption", error ? "text-error-fg" : "text-fg-muted")}>
          {error ?? helper}
        </p>
      ) : null}
    </div>
  );
});
