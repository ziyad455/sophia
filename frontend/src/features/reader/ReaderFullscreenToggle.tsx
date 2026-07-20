import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'

type ReaderFullscreenToggleProps = {
  isFullscreen: boolean
  onToggle: () => void | Promise<void>
}

export function ReaderFullscreenToggle({
  isFullscreen,
  onToggle,
}: ReaderFullscreenToggleProps) {
  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
  const Icon = isFullscreen ? Minimize2 : Maximize2

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="rounded-md text-sophia-text-muted hover:bg-sophia-bg hover:text-sophia-text focus-visible:ring-sophia-primary"
              aria-label={label}
              aria-pressed={isFullscreen}
              onClick={() => void onToggle()}
            />
          }
        >
          <Icon className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
