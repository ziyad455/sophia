import type { ReactNode } from "react"
import { PortalContainerContext, type PortalContainer } from "@/components/ui/portal-container-context"

type PortalContainerProviderProps = {
  children: ReactNode
  container: PortalContainer
}

function PortalContainerProvider({
  children,
  container,
}: PortalContainerProviderProps) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}

export { PortalContainerProvider }
