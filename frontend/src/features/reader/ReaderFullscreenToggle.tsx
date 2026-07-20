import { Maximize2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'

type ReaderFullscreenToggleProps = {
  onEnter: () => void | Promise<void>
}

export function ReaderFullscreenToggle({
  onEnter,
}: ReaderFullscreenToggleProps) {
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
              aria-label="Enter fullscreen"
              onClick={() => void onEnter()}
            />
          }
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Enter fullscreen</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
