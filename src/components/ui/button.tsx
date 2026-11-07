import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  className?: string
  variant?: 'default' | 'secondary' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
}

const variants = {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline:
    'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
}

const sizes = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 gap-1.5 px-3',
  icon: 'size-9',
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
