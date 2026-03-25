import { useState, type ReactNode } from 'react'
import type { AuthUser } from '~/types/api'
import { Sidebar } from './sidebar'
import { Header } from './header'

type AppLayoutProps = {
  readonly user: AuthUser
  readonly children: ReactNode
}

export function AppLayout({ user, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
