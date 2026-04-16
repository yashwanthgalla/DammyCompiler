import type { ReactNode } from 'react'
import './PlatformShell.css'

interface PlatformShellProps {
  children: ReactNode
  showAdmin?: boolean
}

export const PlatformShell = ({ children }: PlatformShellProps) => {
  return (
    <div className="platform-shell">
      <main className="platform-main">{children}</main>
    </div>
  )
}
