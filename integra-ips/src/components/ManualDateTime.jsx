import React from 'react'
import { MdAccessTime, MdEditCalendar } from 'react-icons/md'

// IIPS-021 · Fecha y hora de realización: automática (la del sistema) o manual, cuando el servicio
// empezó o terminó antes de registrarlo. value = '' (automática) o 'YYYY-MM-DDTHH:mm' en hora de Colombia.
export const MANUAL_MAX_DAYS = 30
const bogota = (d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}
export const nowLocal = () => bogota(new Date())

const ManualDateTime = ({ value, onChange, label = 'Fecha y hora de inicio', autoHint, min, allowFuture = false }) => {
  const manual = value !== ''
  const floor = bogota(new Date(Date.now() - MANUAL_MAX_DAYS * 86400000))
  return (
    <div className="manual-dt">
      <label className="rc-check" style={{ margin: 0 }}>
        <input type="checkbox" checked={manual} onChange={(e) => onChange(e.target.checked ? nowLocal() : '')} />
        <span><MdEditCalendar style={{ verticalAlign: '-2px' }} /> Ingresar {label.toLowerCase()} manualmente</span>
      </label>
      {manual ? (
        <div className="field" style={{ marginTop: 10 }}>
          <label>{label} <span className="req">*</span></label>
          <input type="datetime-local" value={value} max={allowFuture ? bogota(new Date(Date.now() + 30 * 86400000)) : nowLocal()} min={min && min > floor ? min : floor} onChange={(e) => onChange(e.target.value)} />
          <span className="hint">Hora de Colombia{allowFuture ? '; puede ser posterior a ahora si la planilla se llena antes del evento' : ''}. Queda constancia de la hora real en que se registró.</span>
        </div>
      ) : (
        <span className="hint" style={{ display: 'block', marginTop: 6 }}><MdAccessTime style={{ verticalAlign: '-2px' }} /> {autoHint || 'Se toma la fecha y la hora del sistema al registrar.'}</span>
      )}
    </div>
  )
}

// Convierte el valor ISO de la API a 'YYYY-MM-DDTHH:mm' (hora de Colombia), útil para "min".
export const toLocalInput = (iso) => (iso ? bogota(new Date(iso)) : undefined)

export default ManualDateTime
