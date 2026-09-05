import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-fg-on-primary hover:bg-primary-hover",
  secondary:
    "bg-surface border border-border text-fg hover:bg-surface-subtle",
  ghost: "bg-transparent text-fg-secondary hover:bg-surface-subtle",
  danger:
    "bg-surface border border-border text-error-fg hover:bg-error-bg",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-label",
  sm: "h-8 px-3 text-[13px]",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps | "href"> & {
    href?: undefined;
  };

type ButtonAsLinkProps = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps | "href"> & {
    href: ComponentPropsWithoutRef<typeof Link>["href"];
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/**
 * Figma "Button" / "Button / Leading Icon" masters (nodes 3:65, 58:12).
 * Buttons hug their content — never give them a fixed width.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    leadingIcon: Icon,
    loading = false,
    disabled,
    className,
    children,
    ...rest
  } = props;

  const base = cn(
    "inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  const content = (
    <span className="relative inline-flex items-center gap-2">
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {Icon ? <Icon aria-hidden="true" size={20} className="shrink-0" /> : null}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === "sm" ? 16 : 18} />
        </span>
      ) : null}
    </span>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...linkRest } = rest as Omit<ButtonAsLinkProps, keyof CommonProps>;
    if (disabled || loading) {
      return (
        <span aria-disabled="true" className={base}>
          {content}
        </span>
      );
    }
    return (
      <Link href={href} className={base} {...linkRest}>
        {content}
      </Link>
    );
  }

  const buttonRest = rest as Omit<ButtonAsButtonProps, keyof CommonProps>;
  return (
    <button
      type={buttonRest.type ?? "button"}
      className={base}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
