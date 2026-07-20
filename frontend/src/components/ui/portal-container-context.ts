import {
  createContext,
  useContext,
  type RefObject,
} from "react"

export type PortalContainer =
  | HTMLElement
  | ShadowRoot
  | null
  | undefined
  | RefObject<HTMLElement | ShadowRoot | null>

export const PortalContainerContext =
  createContext<PortalContainer>(undefined)

export function usePortalContainer() {
  return useContext(PortalContainerContext)
}
