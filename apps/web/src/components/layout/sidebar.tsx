import { Link } from '@tanstack/react-router'

type SidebarProps = {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const navItems = [
  { to: '/articles' as const, label: '記事', icon: '📰' },
  { to: '/feeds' as const, label: 'フィード', icon: '📡' },
  { to: '/bookmarks' as const, label: 'ブックマーク', icon: '🔖' },
  { to: '/notifications' as const, label: '通知', icon: '🔔' },
  { to: '/settings' as const, label: '設定', icon: '⚙️' },
] as const

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          role="presentation"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-bg-card transition-transform lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center px-6">
          <h2 className="text-lg font-bold">RSS Tyoukan</h2>
        </div>
        <nav className="px-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-bg-hover [&.active]:bg-primary/20 [&.active]:text-primary"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
