import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id?: string;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

/** Same chrome as Input, sized for multi-line content. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, helper, error, className, containerClassName, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = `${fieldId}-helper`;
  const hasHelper = Boolean(helper || error);

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label ? (
        <label htmlFor={fieldId} className="text-caption font-bold text-fg-secondary">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn(
          "w-full rounded-md border bg-transparent px-3 py-2.5 text-label text-fg placeholder:text-fg-muted",
          "focus-visible:border-border-focus",
          error ? "border-error-fg" : "border-border",
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasHelper ? helperId : undefined}
        {...rest}
      />
      {hasHelper ? (
        <p id={helperId} className={cn("text-caption", error ? "text-error-fg" : "text-fg-muted")}>
          {error ?? helper}
        </p>
      ) : null}
    </div>
  );
});
