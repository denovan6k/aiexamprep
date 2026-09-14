"use client"

import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react"

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number
  minHeight: number
  onSubmit?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 160,
  minHeight: 36,
  onSubmit: undefined,
  disabled: false,
  textareaRef: React.createRef<HTMLTextAreaElement>()
})

function usePromptInput() {
  return useContext(PromptInputContext)
}

export type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number
  minHeight?: number
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
} & React.ComponentProps<"div">

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 160,
  minHeight = 36,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  onClick,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value ?? "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value)
    }
  }, [value])

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!disabled) textareaRef.current?.focus()
    onClick?.(e)
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          minHeight,
          onSubmit,
          disabled,
          textareaRef
        }}
      >
        <div
          onClick={handleClick}
          className={cn(
            "border-input bg-background flex cursor-text flex-col rounded-3xl border p-2 shadow-xs",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean
  onCursorChange?: (position: number) => void
  /** Return true to skip default Enter-to-submit handling. */
  onBeforeKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
} & React.ComponentProps<typeof Textarea>

function PromptInputTextarea({
  className,
  onKeyDown,
  onBeforeKeyDown,
  onCursorChange,
  disableAutosize = false,
  onSelect,
  onClick,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, minHeight, onSubmit, disabled, textareaRef } =
    usePromptInput()

  const reportCursor = (el: HTMLTextAreaElement | null) => {
    if (el) {
      onCursorChange?.(el.selectionStart)
    }
  }

  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el || disableAutosize) return

    el.style.height = "auto"
    const contentHeight = el.scrollHeight
    const nextHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden"
  }

  const handleRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el
    adjustHeight(el)
  }

  useLayoutEffect(() => {
    adjustHeight(textareaRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, maxHeight, minHeight, disableAutosize])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight(e.target)
    setValue(e.target.value)
    reportCursor(e.target)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e)
    if (onBeforeKeyDown?.(e)) {
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <Textarea
      ref={handleRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onSelect={(e) => {
        reportCursor(e.currentTarget)
        onSelect?.(e)
      }}
      onClick={(e) => {
        reportCursor(e.currentTarget)
        onClick?.(e)
      }}
      onKeyUp={(e) => reportCursor(e.currentTarget)}
      className={cn(
        "text-foreground !min-h-0 w-full resize-none overflow-hidden border-none bg-transparent px-3 py-2 text-sm leading-5 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        className
      )}
      style={{ minHeight: minHeight, maxHeight }}
      rows={1}
      disabled={disabled}
      {...props}
    />
  )
}

export type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

export type PromptInputActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput()

  return (
    <Tooltip {...props}>
      <TooltipTrigger
        asChild
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
  usePromptInput
}
