import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[0.75rem] border border-transparent bg-clip-padding text-sm font-[590] whitespace-nowrap transition-[background-color,box-shadow,transform,opacity] duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-[3.5px] focus-visible:ring-ring/25 active:not-aria-[haspopup]:scale-[0.97] active:not-aria-[haspopup]:opacity-85 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-[3.5px] aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand-solid)] text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.08)] hover:bg-[var(--brand-solid-hover)]",
        outline:
          "border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-card text-primary hover:bg-[color-mix(in_srgb,var(--brand)_7%,var(--card))] aria-expanded:bg-[var(--fill)]",
        secondary:
          "bg-[var(--fill)] text-foreground hover:bg-[var(--fill-strong)] aria-expanded:bg-[var(--fill-strong)]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--fill)] hover:text-foreground aria-expanded:bg-[var(--fill)]",
        destructive:
          "bg-[#ffe5e5] text-[#d70015] hover:bg-[#ffd7d7] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 rounded-[0.625rem] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[0.625rem] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 rounded-[0.875rem] px-4 text-[0.95rem] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-[0.625rem] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[0.625rem] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
