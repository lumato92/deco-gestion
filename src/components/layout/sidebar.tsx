'use client'

// src/components/layout/sidebar.tsx

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, ShoppingCart, ListOrdered, FileText,
  Package, Boxes, ShoppingBag, Truck, ClipboardList,
  Users, TrendingUp, Receipt, Factory, UserCog,
  Moon, Sun, LogOut, type LucideIcon,
} from 'lucide-react'

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

interface UsuarioSesion {
  id: string
  username: string
  nombre: string
  rol: 'root' | 'admin' | 'user'
}

const ROL_BADGE = {
  root:  'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  user:  'bg-gray-100 text-gray-500',
}

// ── Toggle de tema claro / oscuro ─────────────────────────────
function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const el = document.documentElement
    const next = !el.classList.contains('dark')
    el.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
    setDark(next)
  }

  return (
    <button onClick={toggle}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
      {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      {dark ? 'Modo claro' : 'Modo oscuro'}
    </button>
  )
}

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => { if (data.usuario) setUsuario(data.usuario) })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    setCerrando(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const esAdmin = usuario?.rol === 'root' || usuario?.rol === 'admin'

  const nav: {
    section: string
    show?: boolean
    items: { href: string; label: string; show: boolean; icon: LucideIcon }[]
  }[] = [
    {
      section: 'Ventas',
      items: [
        { href: '/dashboard/ventas/nueva',        label: 'Nueva venta',      show: true, icon: ShoppingCart },
        { href: '/dashboard/ventas',              label: 'Todas las ventas', show: true, icon: ListOrdered },
        { href: '/dashboard/ventas/presupuestos', label: 'Presupuestos',     show: true, icon: FileText },
      ],
    },
    {
      section: 'Catálogo',
      items: [
        { href: '/dashboard/productos', label: 'Productos', show: true,    icon: Package },
        { href: '/dashboard/insumos',   label: 'Insumos',   show: esAdmin, icon: Boxes },
      ],
    },
    {
      section: 'Compras',
      show: esAdmin,
      items: [
        { href: '/dashboard/compras/nueva', label: 'Nueva compra',  show: esAdmin, icon: ShoppingBag },
        { href: '/dashboard/compras',       label: 'Compras',       show: esAdmin, icon: Truck },
        { href: '/dashboard/pedidos/nuevo', label: 'Nuevo pedido',  show: esAdmin, icon: ClipboardList },
        { href: '/dashboard/pedidos',       label: 'Pedidos (OC)',  show: esAdmin, icon: ClipboardList },
      ],
    },
    {
      section: 'Negocio',
      items: [
        { href: '/dashboard/clientes',    label: 'Clientes',     show: true,    icon: Users },
        { href: '/dashboard/finanzas',    label: 'Finanzas',     show: esAdmin, icon: TrendingUp },
        { href: '/dashboard/gastos',      label: 'Gastos',       show: esAdmin, icon: Receipt },
        { href: '/dashboard/proveedores', label: 'Proveedores',  show: esAdmin, icon: Factory },
      ],
    },
    ...(usuario?.rol === 'root' ? [{
      section: 'Administración',
      show: true,
      items: [
        { href: '/dashboard/usuarios', label: 'Usuarios', show: true, icon: UserCog },
      ],
    }] : []),
  ]

  return (
    <aside className="w-[210px] border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-900">Deco gestión</span>
        <span className="block text-xs text-gray-400 mt-0.5">Panel de administración</span>
      </div>

      {/* Dashboard */}
      <Link href="/dashboard"
        className={cn(
          'flex items-center gap-2.5 px-4 py-2 text-sm text-gray-500 hover:bg-surface hover:text-gray-900',
          path === '/dashboard' && 'bg-surface text-gray-900 font-medium border-l-2 border-teal-600'
        )}>
        <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
        Dashboard
      </Link>

      {/* Nav por sección */}
      {nav.map(({ section, items, show: showSection = true }) => {
        if (!showSection) return null
        const itemsVisibles = items.filter(i => i.show)
        if (itemsVisibles.length === 0) return null
        return (
          <div key={section}>
            <div className="px-4 py-2 mt-2 text-[10px] text-gray-400 uppercase tracking-widest">
              {section}
            </div>
            {itemsVisibles.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-2.5 pl-7 pr-4 py-2 text-xs text-gray-500 hover:bg-surface hover:text-gray-900',
                  path.startsWith(href) && href !== '/dashboard/compras' && 'bg-surface text-gray-900 font-medium border-l-2 border-teal-600',
                  path === href && 'bg-surface text-gray-900 font-medium border-l-2 border-teal-600',
                )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        )
      })}

      <div className="flex-1" />

      {/* Toggle de tema */}
      <div className="px-3 pt-2">
        <ThemeToggle />
      </div>

      {/* Usuario logueado */}
      {usuario && (
        <div className="border-t border-gray-200 p-3 mt-2">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-medium text-teal-800 flex-shrink-0">
              {usuario.nombre.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-gray-900 truncate">{usuario.nombre}</div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ROL_BADGE[usuario.rol]}`}>
                {usuario.rol}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} disabled={cerrando}
            className="w-full flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50">
            <LogOut className="w-3.5 h-3.5" />
            {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </aside>
  )
}
