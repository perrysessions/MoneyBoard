import Link from 'next/link'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { ProfileMenu } from '@/components/ProfileMenu'

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 grid grid-cols-3 items-center">
      <div className="flex items-center">
        <HamburgerMenu />
      </div>
      <div className="flex items-center justify-center">
        <Link href="/dashboard" className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors">Money Board</Link>
      </div>
      <div className="flex items-center justify-end">
        <ProfileMenu email={email} />
      </div>
    </header>
  )
}
