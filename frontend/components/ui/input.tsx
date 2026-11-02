"use client"

import * as React from "react"
import * as Popover from "@radix-ui/react-popover"
import { CalendarBlank } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

const Calendar = React.lazy(() => import('@/components/ui/calendar').then((module) => ({ default: module.Calendar })))

const inputClass = "flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-base text-foreground shadow-inner-subtle ring-offset-background placeholder:text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-fast hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 md:text-sm"
type DateType = 'date' | 'datetime-local' | 'month'
type InputProps = React.ComponentProps<'input'>

function parseDay(value: string | number | readonly string[] | undefined): Date | undefined {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 ? date : undefined
}
const dayString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const CalendarInput = React.forwardRef<HTMLInputElement, InputProps & { type: DateType }>(
  ({ className, type, "aria-invalid": ariaInvalid, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [open, setOpen] = React.useState(false)
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)
    const selected = parseDay(props.value ?? props.defaultValue)
    const min = parseDay(props.min)
    const max = parseDay(props.max)

    function choose(day: Date) {
      const input = inputRef.current
      if (!input) return
      const value = type === 'month' ? dayString(day).slice(0, 7) : type === 'datetime-local' ? `${dayString(day)}T${input.value.slice(11, 16) || '09:00'}` : dayString(day)
      // Use the native setter so React and form libraries observe the same change as typing.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      setOpen(false)
    }

    return <Popover.Root open={open} onOpenChange={setOpen}>
      <span className={cn('relative inline-flex w-full min-w-0', className)}>
        <input type={type} ref={inputRef} aria-invalid={ariaInvalid} className={cn(inputClass, 'calendar-native-input pr-10', ariaInvalid === true || ariaInvalid === 'true' ? 'border-danger focus-visible:ring-danger' : undefined)} {...props} />
        <Popover.Trigger asChild><button type="button" disabled={props.disabled} aria-label="Abrir calendário" className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-button text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CalendarBlank className="size-4" aria-hidden="true" /></button></Popover.Trigger>
      </span>
      <Popover.Portal><Popover.Content sideOffset={6} align="start" collisionPadding={12} className="z-[100] rounded-lg border border-border bg-popover shadow-popover focus:outline-none">
        <React.Suspense fallback={<p className="p-5 text-sm text-muted-foreground">Carregando calendário...</p>}><Calendar mode="single" selected={selected} defaultMonth={selected ?? new Date()} onSelect={(day) => { if (day) choose(day) }} captionLayout="dropdown" startMonth={min ?? new Date(1900, 0)} endMonth={max ?? new Date(2100, 11)} disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]} /></React.Suspense>
        {type === 'datetime-local' && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">A hora pode ser ajustada no campo.</p>}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  }
)
CalendarInput.displayName = 'CalendarInput'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, "aria-invalid": ariaInvalid, ...props }, ref) => {
    if (type === 'date' || type === 'datetime-local' || type === 'month') return <CalendarInput type={type as DateType} className={className} aria-invalid={ariaInvalid} ref={ref} {...props} />
    return (
      <input
        type={type}
        className={cn(
          inputClass,
          ariaInvalid === true || ariaInvalid === "true" ? "border-danger focus-visible:ring-danger" : undefined,
          className,
        )}
        ref={ref}
        aria-invalid={ariaInvalid}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
