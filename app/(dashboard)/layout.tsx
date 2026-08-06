import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { getAuthUser } from '@/lib/auth/server'
import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await getAuthUser()
  } catch (err) {
    if (isRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : ''
    if (message === 'SetupRequired') redirect('/setup')
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
