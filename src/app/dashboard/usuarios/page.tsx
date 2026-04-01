'use client'

// src/app/dashboard/usuarios/page.tsx
// Solo accesible para rol 'root'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Usuario {
  id: string
  username: string
  nombre: string
  rol: 'root' | 'admin' | 'user'
  activo: boolean
  created_at: string
}

const ROL_CFG = {
  root:  { label: 'Root',  cls: 'bg-purple-50 text-purple-800' },
  admin: { label: 'Admin', cls: 'bg-blue-50 text-blue-800' },
  user:  { label: 'User',  cls: 'bg-gray-100 text-gray-600' },
}

// ── Modal nuevo/editar usuario ────────────────────────────────

function ModalUsuario({ usuario, onGuardar, onCerrar }: {
  usuario?: Usuario
  onGuardar: () => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [username, setUsername] = useState(usuario?.username ?? '')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<'admin' | 'user'>(
    usuario?.rol === 'admin' ? 'admin' : 'user'
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleGuardar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!username.trim()) { setError('El nombre de usuario es obligatorio'); return }
    if (!usuario && !password) { setError('La contraseña es obligatoria para usuarios nuevos'); return }
    if (password && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch('/api/usuarios', {
        method: usuario ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: usuario?.id,
          nombre: nombre.trim(),
          username: username.trim().toLowerCase(),
          password: password || undefined,
          rol,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); setGuardando(false); return }

      onGuardar()
      onCerrar()
    } catch {
      setError('Error de conexión')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm flex flex-col gap-4">
        <h3 className="text-sm font-medium text-gray-900">
          {usuario ? 'Editar usuario' : 'Nuevo usuario'}
        </h3>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre completo *</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: María González" autoFocus
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Nombre de usuario *</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="sin espacios, ej: maria.gonzalez"
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">
              Contraseña {usuario ? '(dejar vacío para no cambiar)' : '*'}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={usuario ? 'Nueva contraseña (opcional)' : 'Mínimo 6 caracteres'}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-400" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wide">Rol</label>
            <div className="flex gap-2">
              {([
                { val: 'admin', label: 'Admin', desc: 'Acceso total' },
                { val: 'user',  label: 'User',  desc: 'Solo ventas y clientes' },
              ] as const).map(r => (
                <label key={r.val}
                  className={`flex-1 flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                    rol === r.val ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="rol" checked={rol === r.val}
                    onChange={() => setRol(r.val)} className="sr-only" />
                  <span className="text-[13px] font-medium text-gray-900">{r.label}</span>
                  <span className="text-[11px] text-gray-400 mt-0.5">{r.desc}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-[11px] text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onCerrar}
            className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; usuario?: Usuario }>({ open: false })
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null)

  const cargar = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('usuarios')
      .select('id, username, nombre, rol, activo, created_at')
      .order('created_at')
    setUsuarios(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const toggleActivo = async (u: Usuario) => {
    if (u.rol === 'root') return // No se puede desactivar el root
    setCambiandoEstado(u.id)
    const supabase = createClient()
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id)
    await cargar()
    setCambiandoEstado(null)
  }

  return (
    <div className="p-5 flex flex-col gap-4">

      {modal.open && (
        <ModalUsuario
          usuario={modal.usuario}
          onGuardar={cargar}
          onCerrar={() => setModal({ open: false })}
        />
      )}

      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Administración</p>
          <h1 className="text-base font-medium text-gray-900">Usuarios</h1>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          + Nuevo usuario
        </button>
      </div>

      {/* Info de roles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { rol: 'root',  desc: 'Acceso total. Gestiona usuarios. No se puede crear desde este panel.' },
          { rol: 'admin', desc: 'Acceso total al sistema: ventas, productos, insumos, gastos y finanzas.' },
          { rol: 'user',  desc: 'Solo ventas, presupuestos, devoluciones y clientes. Sin acceso a insumos, gastos ni finanzas.' },
        ].map(r => (
          <div key={r.rol} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${ROL_CFG[r.rol as keyof typeof ROL_CFG].cls}`}>
                {ROL_CFG[r.rol as keyof typeof ROL_CFG].label}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">Usuario</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">Nombre</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">Rol</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                    </td>
                  </tr>
                ))
              : usuarios.map(u => (
                  <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 font-mono text-[11px]">
                      {u.username}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${ROL_CFG[u.rol].cls}`}>
                        {ROL_CFG[u.rol].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.activo ? 'bg-teal-50 text-teal-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {u.rol !== 'root' && (
                          <>
                            <button
                              onClick={() => setModal({ open: true, usuario: u })}
                              className="text-[11px] px-2 py-1 border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
                              Editar
                            </button>
                            <button
                              onClick={() => toggleActivo(u)}
                              disabled={cambiandoEstado === u.id}
                              className={`text-[11px] px-2 py-1 border rounded disabled:opacity-50 ${
                                u.activo
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-teal-200 text-teal-600 hover:bg-teal-50'
                              }`}>
                              {cambiandoEstado === u.id ? '...' : u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}
                        {u.rol === 'root' && (
                          <span className="text-[11px] text-gray-300 px-2">Protegido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}