import { useEffect } from 'react'
import { navigate } from './navigation'

type NavigateProps = {
  replace?: boolean
  to: string
}

export function Navigate({ replace = false, to }: NavigateProps) {
  useEffect(() => {
    navigate(to, { replace })
  }, [replace, to])

  return null
}
