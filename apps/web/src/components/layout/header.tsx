import type { AuthUser } from '~/types/api'
import { signOut } from '~/lib/auth'
import { useNavigate } from '@tanstack/react-router'

type HeaderProps = {
  readonly user: AuthUser
  readonly onMenuToggle: () => void
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-bg-card px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-lg p-2 transition hover:bg-bg-hover lg:hidden"
        aria-label="メニュー"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-text-muted sm:block">
          {user.name}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg px-3 py-1.5 text-sm text-text-muted transition hover:bg-bg-hover hover:text-text"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
