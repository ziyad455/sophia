"use client"

import type * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

type ScrollAreaOrientation = "vertical" | "horizontal" | "both"

type ScrollAreaRootProps = ScrollAreaPrimitive.Root.Props & {
  orientation?: ScrollAreaOrientation
  scrollFade?: boolean
  viewportClassName?: string
  viewportProps?: ScrollAreaPrimitive.Viewport.Props
  viewportRef?: React.Ref<HTMLDivElement>
}

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  scrollFade,
  viewportClassName,
  viewportProps,
  viewportRef,
  ...props
}: ScrollAreaRootProps) {
  const { className: viewportPropsClassName, ...resolvedViewportProps } = viewportProps ?? {}
  const showHorizontalScrollbar = orientation === "horizontal" || orientation === "both"
  const showVerticalScrollbar = orientation === "vertical" || orientation === "both"

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      data-scroll-fade={scrollFade ? "" : undefined}
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName,
          viewportPropsClassName
        )}
        {...resolvedViewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVerticalScrollbar ? <ScrollBar orientation="vertical" /> : null}
      {showHorizontalScrollbar ? <ScrollBar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
