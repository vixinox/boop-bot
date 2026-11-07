import { Dialog } from '@base-ui/react/dialog'
import type { ComponentProps, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close
export const SheetTitle = Dialog.Title
export const SheetDescription = Dialog.Description

export function SheetContent({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Dialog.Popup>, 'className'> & { className?: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
      <Dialog.Popup
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(22rem,calc(100vw-2rem))] flex-col border-l bg-background shadow-xl outline-none transition-transform duration-200 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  )
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5 border-b p-5', className)} {...props} />
  )
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', className)} {...props} />
  )
}
