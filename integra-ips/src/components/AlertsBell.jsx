import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdNotifications, MdError, MdWarning, MdInfo, MdRefresh, MdCheckCircle } from 'react-icons/md'
import { useAlerts } from '../context/AlertsContext'

const ICON = { bad: <MdError />, warn: <MdWarning />, info: <MdInfo /> }
const FILTERS = [['all', 'Todos'], ['bad', 'Urgentes'], ['warn', 'Por atender'], ['info', 'Informativos']]

// IIPS-022 · Campana de la barra superior: total de avisos y lista con enlace a cada uno.
const AlertsBell = () => {
  const { data, refresh } = useAlerts()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  const items = data?.items || []
  const urgent = items.filter((x) => x.level === 'bad').length
  const shown = filter === 'all' ? items : items.filter((x) => x.level === filter)
  return (
    <div className="alerts-bell" ref={ref}>
      <button type="button" className="btn btn-ghost btn-icon" aria-label={`Notificaciones (${items.length})`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MdNotifications />
        {items.length > 0 && <span className={`bell-badge${urgent ? ' bad' : ''}`}>{items.length > 99 ? '99+' : items.length}</span>}
      </button>
      {open && (
        <div className="alerts-panel" role="dialog" aria-label="Notificaciones">
          <div className="alerts-panel-head">
            <strong>Notificaciones</strong>
            <button type="button" className="btn btn-ghost btn-icon" title="Actualizar" aria-label="Actualizar" onClick={refresh}><MdRefresh /></button>
          </div>
          <div className="alerts-filters">
            {FILTERS.map(([k, l]) => {
              const n = k === 'all' ? items.length : items.filter((x) => x.level === k).length
              return <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}{n ? ` · ${n}` : ''}</button>
            })}
          </div>
          <div className="alerts-list">
            {shown.length === 0 ? <div className="alerts-empty"><MdCheckCircle /> Sin avisos {filter === 'all' ? 'pendientes' : 'en este filtro'}.</div> : shown.map((x) => (
              <button key={x.id} type="button" className={`alerts-item ${x.level}`} onClick={() => { setOpen(false); navigate(x.link) }}>
                <span className="alerts-item-icon">{ICON[x.level]}</span>
                <span className="alerts-item-text"><b>{x.title}</b><span>{x.message}</span></span>
              </button>
            ))}
          </div>
          {data?.total > items.length && <div className="alerts-more">Se muestran {items.length} de {data.total} avisos.</div>}
        </div>
      )}
    </div>
  )
}

export default AlertsBell
