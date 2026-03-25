import { Link } from '@tanstack/react-router'
import { Newspaper, Rss, Bookmark, Bell, Settings, type LucideIcon } from 'lucide-react'

type SidebarProps = {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const navItems: readonly { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/articles', label: '記事', icon: Newspaper },
  { to: '/feeds', label: 'フィード', icon: Rss },
  { to: '/bookmarks', label: 'ブックマーク', icon: Bookmark },
  { to: '/notifications', label: '通知', icon: Bell },
  { to: '/settings', label: '設定', icon: Settings },
]

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
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
