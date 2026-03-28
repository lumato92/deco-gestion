'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Plus, List, FileText,
  Package, Layers, Users, TrendingUp, DollarSign
} from 'lucide-react'

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const nav = [
  {
    section: 'Ventas',
    items: [
      { href: '/dashboard/ventas/nueva',        label: 'Nueva venta',      icon: Plus },
      { href: '/dashboard/ventas',              label: 'Todas las ventas', icon: List },
      { href: '/dashboard/ventas/presupuestos', label: 'Presupuestos',     icon: FileText },
    ],
  },
  {
    section: 'Catálogo',
    items: [
      { href: '/dashboard/productos', label: 'Productos', icon: Package },
      { href: '/dashboard/insumos',   label: 'Insumos',   icon: Layers },
    ],
  },
  {
    section: 'Negocio',
    items: [
      { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
      { href: '/dashboard/finanzas', label: 'Finanzas', icon: TrendingUp },
      { href: '/dashboard/gastos',   label: 'Gastos',   icon: DollarSign },
    ],
  },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-[200px] border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
      <div className="px-4 py-4 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-900">Deco gestión</span>
        <span className="block text-xs text-gray-400 mt-0.5">Panel de administración</span>
      </div>

      <Link
        href="/dashboard"
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-white hover:text-gray-900',
          path === '/dashboard' && 'bg-white text-gray-900 font-medium border-l-2 border-teal-600'
        )}
      >
        <LayoutGrid size={14} className="opacity-60" />
        Dashboard
      </Link>

      {nav.map(({ section, items }) => (
        <div key={section}>
          <div className="px-4 py-2 mt-2 text-[10px] text-gray-400 uppercase tracking-widest">
            {section}
          </div>
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 pl-8 pr-4 py-2 text-xs text-gray-500 hover:bg-white hover:text-gray-900',
                path.startsWith(href) && href !== '/ventas' && 'bg-white text-gray-900 font-medium border-l-2 border-teal-600',
                path === href && 'bg-white text-gray-900 font-medium border-l-2 border-teal-600'
              )}
            >
              <Icon size={14} className="opacity-60 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  )
}
