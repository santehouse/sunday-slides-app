import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  id?: string;
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
  containerClassName?: string;
};

/**
 * Figma "Select" master (node 3:70). Native `<select>` for full accessibility
 * and keyboard support, with a right-aligned decorative chevron overlay.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, helper, error, options, className, containerClassName, children, ...rest },
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
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          className={cn(
            "h-10 w-full appearance-none rounded-md border bg-transparent px-3 pr-9 text-label text-fg",
            "focus-visible:border-border-focus",
            error ? "border-error-fg" : "border-border",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasHelper ? helperId : undefined}
          {...rest}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-fg-muted">
          <ChevronDown aria-hidden="true" size={20} />
        </span>
      </div>
      {hasHelper ? (
        <p id={helperId} className={cn("text-caption", error ? "text-error-fg" : "text-fg-muted")}>
          {error ?? helper}
        </p>
      ) : null}
    </div>
  );
});
