import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type IconButtonSize = 36 | 40 | 44 | 48;
export type IconButtonVariant = "ghost" | "outlined";

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-fg hover:bg-surface-subtle",
  outlined: "bg-surface border border-border text-fg hover:bg-surface-subtle",
};

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  icon: LucideIcon;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  "aria-label": string;
};

/**
 * Square icon-only touch target (Figma "Icon Button"). Icon renders at its
 * native 24px geometry, centered inside the fixed square box.
 */
export function IconButton({
  icon: Icon,
  size = 40,
  variant = "ghost",
  className,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      style={{ width: size, height: size }}
      disabled={disabled}
      {...rest}
    >
      <Icon aria-hidden="true" size={24} />
    </button>
  );
}
