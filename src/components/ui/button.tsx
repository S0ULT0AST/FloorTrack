import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold tracking-tight transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-amber text-amber-ink hover:brightness-110",
        quiet: "bg-sunken text-text border border-line hover:border-amber",
        danger: "bg-danger text-white hover:brightness-110",
        ghost: "bg-transparent text-muted hover:text-text hover:bg-sunken",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-10 px-3",
        lg: "h-11 px-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
