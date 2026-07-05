import { useEffect, useState } from 'react'

const ROUTE_CHANGE_EVENT = 'sophia-route-change'
export const AUTHENTICATED_HOME_PATH = '/library'

export type RouteLocation = {
  pathname: string
  search: string
  hash: string
}

export type NavigateOptions = {
  replace?: boolean
}

export function getRouteLocation(): RouteLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

export function routeToString(location: RouteLocation): string {
  return `${location.pathname}${location.search}${location.hash}`
}

export function navigate(to: string, options: NavigateOptions = {}) {
  const method = options.replace ? 'replaceState' : 'pushState'

  window.history[method](null, '', to)
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
}

export function useRouteLocation() {
  const [location, setLocation] = useState<RouteLocation>(() => getRouteLocation())

  useEffect(() => {
    function handleLocationChange() {
      setLocation(getRouteLocation())
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)
    }
  }, [])

  return location
}

export function getSafeRedirectPath(search: string): string {
  const redirectTo = new URLSearchParams(search).get('redirectTo')

  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return AUTHENTICATED_HOME_PATH
  }

  return redirectTo
}

export function createLoginRedirect(location: RouteLocation): string {
  const attemptedPath = routeToString(location)
  const redirectTo = encodeURIComponent(attemptedPath)

  return `/login?redirectTo=${redirectTo}`
}
