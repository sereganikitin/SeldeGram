"use client";

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "filled" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  variant?: Variant;
  size?: Size;
  label?: string;
}

const sizeMap: Record<Size, { box: string; icon: number }> = {
  sm: { box: "w-8 h-8", icon: 16 },
  md: { box: "w-10 h-10", icon: 20 },
  lg: { box: "w-12 h-12", icon: 22 },
};

const variantMap: Record<Variant, string> = {
  filled:
    "bg-gradient-to-br from-brand to-brand-dark text-white hover:from-brand-dark hover:to-brand-dark shadow-sm dark:from-brand dark:to-brand-dark",
  ghost:
    "bg-cream-alt text-brand-dark hover:bg-cream-border dark:bg-slate-800 dark:text-brand dark:hover:bg-slate-700",
  danger:
    "bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700",
  success:
    "bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700",
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { icon: Icon, variant = "filled", size = "md", label, className, ...rest },
  ref,
) {
  const s = sizeMap[size];
  const v = variantMap[variant];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label ?? rest.title}
      title={rest.title ?? label}
      className={`${s.box} rounded-full flex items-center justify-center transition ${v} ${className ?? ""}`}
      {...rest}
    >
      <Icon size={s.icon} strokeWidth={2} />
    </button>
  );
});
