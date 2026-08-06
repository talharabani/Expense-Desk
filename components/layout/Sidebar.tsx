'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, TrendingUp, Receipt, CheckSquare,
  Wallet, Users, CreditCard, Target, Building2,
  FolderKanban, Briefcase, UserCog, FileText,
  ScrollText, Settings, HandCoins, ChevronRight,
} from 'lucide-react'

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

export function Sidebar() {
  const pathname = usePathname()
  const [userName, setUserName] = useState('Finance Manager')
  const [userEmail, setUserEmail] = useState('finance@company.com')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        if (u.email) setUserEmail(u.email)
        const metaName = u.user_metadata?.name || u.user_metadata?.full_name
        if (metaName) {
          setUserName(metaName)
        } else {
          supabase
            .from('users')
            .select('name')
            .eq('id', u.id)
            .single()
            .then(({ data: profile }) => {
              if (profile?.name) {
                setUserName(profile.name)
              } else if (u.email) {
                const part = u.email.split('@')[0].replace(/[0-9]/g, '')
                const capitalized = part.replace(/([a-z])([a-z]*)/g, (_, g1, g2) => g1.toUpperCase() + g2)
                setUserName(capitalized || 'Finance Manager')
              }
            })
        }
      }
    })
  }, [])

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 rounded-r-[32px] overflow-hidden" style={{ backgroundColor: 'var(--sidebar)' }}>
      {/* Profile Section */}
      <div className="px-6 pt-8 pb-6 flex flex-col items-center border-b border-white/5">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-[#c19a3b] p-1 flex items-center justify-center bg-[#1c2e2a]">
            <div className="h-full w-full rounded-full bg-[#c19a3b]/20 flex items-center justify-center text-lg font-bold text-[#c19a3b]">
              {initials}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 border-2 border-[#2c443e]" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-white tracking-wider uppercase text-center">{userName}</h3>
        <p className="text-xs text-[#a3b8b3] truncate max-w-full mt-0.5">{userEmail}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pl-4 py-6 pr-0 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 pl-4 pr-3 py-3 text-sm font-medium transition-all duration-150 relative rounded-l-2xl rounded-r-none',
                isActive
                  ? 'bg-background text-foreground font-bold shadow-none'
                  : 'hover:bg-white/5 text-[#a3b8b3] hover:text-white'
              )}
            >
              {isActive && (
                <>
                  <div className="absolute right-0 -top-4 w-4 h-4 bg-background pointer-events-none">
                    <div className="absolute inset-0 bg-[#2c443e] rounded-br-2xl" />
                  </div>
                  <div className="absolute right-0 -bottom-4 w-4 h-4 bg-background pointer-events-none">
                    <div className="absolute inset-0 bg-[#2c443e] rounded-tr-2xl" />
                  </div>
                </>
              )}
              <item.icon className={cn('h-4 w-4 flex-shrink-0 transition-transform', isActive && 'scale-110 text-[#c19a3b]')} />
              <span className="flex-1 truncate">{item.name}</span>
              {isActive && <ChevronRight className="h-3 w-3 text-[#c19a3b]" />}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      <div className="px-6 py-4 border-t border-white/5 flex-shrink-0">
        <p className="text-xs text-[#a3b8b3]/60">v1.0 · Business Suite</p>
      </div>
    </aside>
  )
}
