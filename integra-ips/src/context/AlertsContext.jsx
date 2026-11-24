import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdClose, MdError, MdWarning, MdInfo, MdNotificationsActive } from 'react-icons/md'
import api from '../api/client'
import { useAuth } from './AuthContext'

// IIPS-022 · Centro de notificaciones.
// Consulta GET /alertas (cada 90 s, al volver a la pestaña y después de cada cambio) y expone:
//   · counts por ruta del menú (burbujas), items (campana) y toasts de avisos nuevos.
const POLL_MS = 90000
const SEEN_MAX = 600
const Ctx = createContext({ data: null, countFor: () => 0, refresh: () => {} })
export const useAlerts = () => useContext(Ctx)

const seenKey = (u) => `cv:alerts-seen:${u}`
const readSeen = (u) => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(u)) || 'null') || []) } catch { return null } }
const writeSeen = (u, set) => { try { localStorage.setItem(seenKey(u), JSON.stringify([...set].slice(-SEEN_MAX))) } catch { /* sin almacenamiento */ } }
const ICON = { bad: <MdError />, warn: <MdWarning />, info: <MdInfo /> }

export const AlertsProvider = ({ children }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [toasts, setToasts] = useState([])
  const timer = useRef(null)
  const uid = user?.id

  const pushToast = useCallback((t) => {
    const key = `${Date.now()}-${Math.random()}`
    setToasts((ts) => [...ts.slice(-2), { ...t, key }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.key !== key)), 7000)
  }, [])

  const load = useCallback(async (fresh) => {
    if (!uid) return
    try {
      const { data: d } = await api.get('/alertas', { params: fresh ? { fresh: 1 } : undefined, noCache: true })
      setData(d)
      const ids = d.items.filter((x) => x.level !== 'info').map((x) => x.id)
      const seen = readSeen(uid)
      if (!seen) {
        // Primera vez en este navegador: un solo resumen, sin repetir cada aviso.
        writeSeen(uid, new Set(d.items.map((x) => x.id)))
        const urgent = d.items.filter((x) => x.level === 'bad').length
        if (ids.length) pushToast({ level: urgent ? 'bad' : 'warn', title: `Tienes ${ids.length} aviso${ids.length === 1 ? '' : 's'} pendiente${ids.length === 1 ? '' : 's'}`, message: urgent ? `${urgent} urgente${urgent === 1 ? '' : 's'}. Revisa la campana.` : 'Revisa la campana.' })
        return
      }
      const fresh2 = d.items.filter((x) => x.level !== 'info' && !seen.has(x.id))
      if (fresh2.length > 3) pushToast({ level: fresh2.some((x) => x.level === 'bad') ? 'bad' : 'warn', title: `${fresh2.length} avisos nuevos`, message: 'Revisa la campana de notificaciones.' })
      else fresh2.forEach((x) => pushToast(x))
      if (fresh2.length) { fresh2.forEach((x) => seen.add(x.id)); writeSeen(uid, seen) }
    } catch { /* sin conexión: se intenta en el próximo ciclo */ }
  }, [uid, pushToast])

  useEffect(() => {
    if (!uid) { setData(null); return undefined }
    load()
    const id = setInterval(() => load(), POLL_MS)
    const onFocus = () => { if (document.visibilityState !== 'hidden') load() }
    // Tras un cambio (POST/PUT/DELETE) se espera un momento para agrupar varios cambios seguidos.
    const onChange = () => { clearTimeout(timer.current); timer.current = setTimeout(() => load(true), 1500) }
    window.addEventListener('focus', onFocus)
    window.addEventListener('cv:alerts-refresh', onChange)
    return () => { clearInterval(id); clearTimeout(timer.current); window.removeEventListener('focus', onFocus); window.removeEventListener('cv:alerts-refresh', onChange) }
  }, [uid, load])

  const countFor = useCallback((route) => data?.counts?.[route] || 0, [data])
  const value = useMemo(() => ({ data, countFor, refresh: () => load(true) }), [data, countFor, load])

  return (
    <Ctx.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="alert-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.key} className={`alert-toast ${t.level}`}>
              <span className="alert-toast-icon">{ICON[t.level] || <MdNotificationsActive />}</span>
              <button type="button" className="alert-toast-body" onClick={() => { if (t.link) navigate(t.link); setToasts((ts) => ts.filter((x) => x.key !== t.key)) }}>
                <b>{t.title}</b><span>{t.message}</span>
              </button>
              <button type="button" className="alert-toast-close" aria-label="Cerrar" onClick={() => setToasts((ts) => ts.filter((x) => x.key !== t.key))}><MdClose /></button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}
