'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Bell, LogOut, User, ChevronDown, Menu, X, 
  LayoutDashboard, TrendingUp, Receipt, CheckSquare,
  Wallet, Users, CreditCard, Target, Building2,
  FolderKanban, Briefcase, UserCog, FileText,
  ScrollText, Settings, HandCoins
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/income': 'Income',
  '/expenses': 'Expenses',
  '/approvals': 'Approvals',
  '/accounts': 'Accounts',
  '/payroll': 'Payroll',
  '/advances': 'Advances',
  '/subscriptions': 'Subscriptions',
  '/budgets': 'Budgets',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/vendors': 'Vendors',
  '/employees': 'Employees',
  '/reports': 'Reports',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
}

const navigation = [
  { name: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard },
  { name: 'Income',        href: '/income',         icon: TrendingUp },
  { name: 'Expenses',      href: '/expenses',       icon: Receipt },
  { name: 'Approvals',     href: '/approvals',      icon: CheckSquare },
  { name: 'Accounts',      href: '/accounts',       icon: Wallet },
  { name: 'Payroll',       href: '/payroll',        icon: Users },
  { name: 'Advances',      href: '/advances',       icon: HandCoins },
  { name: 'Subscriptions', href: '/subscriptions',  icon: CreditCard },
  { name: 'Budgets',       href: '/budgets',        icon: Target },
  { name: 'Clients',       href: '/clients',        icon: Building2 },
  { name: 'Projects',      href: '/projects',       icon: FolderKanban },
  { name: 'Vendors',       href: '/vendors',        icon: Briefcase },
  { name: 'Employees',     href: '/employees',      icon: UserCog },
  { name: 'Reports',       href: '/reports',        icon: FileText },
  { name: 'Audit Logs',    href: '/audit-logs',     icon: ScrollText },
  { name: 'Settings',      href: '/settings',       icon: Settings },
]

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('User')
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1] ?? 'Dashboard'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        const name = u.user_metadata?.name || u.user_metadata?.full_name
        if (name) {
          setUserName(name)
        } else {
          supabase
            .from('users')
            .select('name')
            .eq('id', u.id)
            .single()
            .then(({ data: profile }) => {
              if (profile?.name) setUserName(profile.name)
            })
        }
      }
    })
    
    fetch('/api/notifications?unreadOnly=true&limit=1')
      .then(r => r.ok ? r.json() : [])
      .then(d => setUnread(Array.isArray(d) ? d.length : 0))
      .catch(() => {})
  }, [pathname])

  // Close the mobile drawer whenever the route changes. Adjusting state during
  // render (rather than in an effect) avoids an extra render pass with the
  // drawer still open on the new page.
  const [drawerPath, setDrawerPath] = useState(pathname)
  if (drawerPath !== pathname) {
    setDrawerPath(pathname)
    setMobileOpen(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-16 items-center justify-between bg-transparent border-0 px-6 flex-shrink-0 relative z-40">
      
      {/* Title & Burger Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden h-9 w-9 rounded-xl bg-white/75 border border-white/20 hover:bg-white flex items-center justify-center transition-colors shadow-sm text-[#2c443e]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-[#2c443e] tracking-tight">{title}</h1>
          <p className="text-xs text-[#6c857f] hidden sm:block">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative h-9 w-9 rounded-xl bg-white/75 border border-white/20 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
        >
          <Bell className="h-4 w-4 text-[#2c443e]" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/75 border border-white/20 hover:bg-white transition-colors shadow-sm"
          >
            <div className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-[#c19a3b]">
              {initials}
            </div>
            <span className="text-sm font-semibold text-[#2c443e] hidden sm:block">{userName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#6c857f]" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 w-44 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden">
                <button
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  onClick={() => { setMenuOpen(false); router.push('/settings') }}
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                <div className="border-t border-gray-100" />
                <button
                  className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide-over Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          
          {/* Side Panel */}
          <div className="fixed inset-y-0 left-0 w-64 bg-[#2c443e] text-white flex flex-col p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <span className="font-extrabold text-sm tracking-widest uppercase text-[#c19a3b]">Expense Desk</span>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav list */}
            <nav className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150',
                      isActive
                        ? 'bg-[#c19a3b] text-white'
                        : 'text-[#a3b8b3] hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-[#a3b8b3]">
              <span>v1.0.0</span>
              <button onClick={signOut} className="text-rose-400 hover:text-rose-500 font-bold uppercase tracking-wider">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
