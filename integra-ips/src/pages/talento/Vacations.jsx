import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBeachAccess, MdAdd, MdDelete, MdErrorOutline, MdSave, MdInfoOutline, MdSend, MdCheck, MdEventRepeat } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { PageHead, Card, Modal, Empty, Spinner, useToast } from '../../components/ui'
import { fmt, thBase, thScope, THSCOPE_LABEL } from './common'

// IIPS-026 · Vacaciones según el Código Sustantivo del Trabajo (art. 186 y ss.):
// 15 días hábiles consecutivos por cada año de servicio, proporcionales al tiempo trabajado,
// solo en vinculación laboral directa. Se pueden acumular hasta dos periodos (art. 190).
const days = (n) => `${Math.floor(n * 10) / 10} día${n === 1 ? '' : 's'}`

const VacationForm = ({ staffId, onClose, onSaved }) => {
  const [f, setF] = useState({ startDate: '', businessDays: 15, kind: 'disfrute', notes: '' })
  const [calc, setCalc] = useState(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => {
    setCalc(null)
    if (f.kind !== 'disfrute' || !f.startDate || !(Number(f.businessDays) > 0)) return
    api.get('/estandares/th/vacaciones/calcular', { params: { inicio: f.startDate, dias: f.businessDays } }).then(({ data }) => setCalc(data)).catch(() => {})
  }, [f.startDate, f.businessDays, f.kind])
  const submit = async () => {
    setError('')
    if (!f.startDate) return setError('Indica la fecha de inicio.')
    setSaving(true)
    try { const { data } = await api.post(`/estandares/th/personal/${staffId}/vacaciones`, { ...f, businessDays: Number(f.businessDays) }); onSaved(data) } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title="Registrar vacaciones" size="sm" onClose={onClose}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="module-switch inline">
          <button type="button" className={f.kind === 'disfrute' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'disfrute' })}>Disfrute</button>
          <button type="button" className={f.kind === 'compensadas' ? 'on' : ''} onClick={() => setF({ ...f, kind: 'compensadas' })}>Compensadas en dinero</button>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field"><label>{f.kind === 'disfrute' ? 'Sale a vacaciones' : 'Fecha del pago'}</label><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div className="field"><label>Días hábiles</label><input type="number" min="1" max="90" step="0.5" value={f.businessDays} onChange={(e) => setF({ ...f, businessDays: e.target.value })} /></div>
        </div>
        {calc && <div className="alert info" style={{ margin: 0 }}><MdInfoOutline /><span>Último día de vacaciones: <b>{fmt(calc.end)}</b>. Regresa el <b>{fmt(calc.returnDate)}</b>. Se cuentan de lunes a viernes sin festivos.</span></div>}
        {f.kind === 'compensadas' && <span className="hint">Solo se puede compensar en dinero hasta la mitad de las vacaciones (CST art. 189).</span>}
        <div className="field"><label>Observación</label><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Periodo que se disfruta, resolución…" /></div>
        {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      </div>
    </Modal>
  )
}

// Tarjeta de vacaciones de una persona (hoja de vida y "Mi hoja de vida").
export const VacationCard = ({ staffId, initial, readOnly }) => {
  const [toast, toastNode] = useToast()
  const [v, setV] = useState(initial || null)
  const [adding, setAdding] = useState(false)
  useEffect(() => { if (!initial && staffId) api.get(`/estandares/th/personal/${staffId}/vacaciones`, { noCache: true }).then(({ data }) => setV(data)).catch(() => setV({ applies: false, reason: 'No se pudo calcular.' })) }, [staffId, initial])
  const remove = async (id) => { try { const { data } = await api.delete(`/estandares/th/personal/${staffId}/vacaciones/${id}`); setV(data); toast('Registro eliminado') } catch (e) { toast(errorMessage(e), 'bad') } }
  if (!v) return <Card title="Vacaciones"><Spinner /></Card>
  return (
    <Card title="Vacaciones" icon={<MdBeachAccess style={{ color: 'var(--brand)' }} />}
      actions={v.applies && !readOnly ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(true)}><MdAdd /> Registrar</button> : null}>
      {!v.applies ? <p style={{ margin: 0, color: 'var(--muted)' }}>{v.reason}</p> : (
        <>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div><span className="label">Saldo disponible</span><div style={{ fontSize: 22, fontWeight: 700, color: v.balance >= 30 ? 'var(--bad)' : v.balance >= 15 ? 'var(--warn)' : 'var(--ink)' }}>{days(v.balance)} hábiles</div></div>
            <div><span className="label">Próximo periodo</span><div>{fmt(v.nextPeriodDate)} <small style={{ color: 'var(--muted)' }}>({v.daysToNextPeriod} días)</small></div></div>
            <div><span className="label">Causados</span><div>{days(v.accrued)} · desde {fmt(v.since)}</div></div>
            <div><span className="label">Disfrutados o compensados</span><div>{days(v.taken)}</div></div>
          </div>
          <span className="hint" style={{ display: 'block', marginTop: 8 }}>{v.contractTypeLabel}: 15 días hábiles por cada año de servicio (CST art. 186), proporcional al tiempo trabajado.{v.balance >= 30 ? ' Acumula dos periodos: es el máximo permitido (art. 190).' : ''}</span>
          {v.history?.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 10 }}><table className="table">
              <thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th className="num">Días</th>{!readOnly && <th className="actions" />}</tr></thead>
              <tbody>{v.history.map((h) => <tr key={h.id}><td>{h.kind === 'compensadas' ? 'Compensadas' : 'Disfrute'}{h.notes ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{h.notes}</div> : null}</td><td>{fmt(h.startDate)}</td><td>{h.kind === 'compensadas' ? '—' : fmt(h.endDate)}</td><td className="num">{h.businessDays}</td>{!readOnly && <td className="actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" style={{ color: 'var(--bad)' }} onClick={() => remove(h.id)}><MdDelete /></button></td>}</tr>)}</tbody>
            </table></div>
          )}
        </>
      )}
      {adding && <VacationForm staffId={staffId} onClose={() => setAdding(false)} onSaved={(d) => { setV(d); setAdding(false); toast('Vacaciones registradas') }} />}
      {toastNode}
    </Card>
  )
}


const REQ_BADGE = { pendiente: 'warn', aprobada: 'ok', reprogramada: 'ok', rechazada: 'bad', cancelada: '' }

// IIPS-036 · El empleado solicita sus vacaciones dentro de los días disponibles.
const RequestForm = ({ available, onClose, onSaved }) => {
  const [f, setF] = useState({ startDate: '', businessDays: Math.min(15, Math.floor(available)) || 1, notes: '' })
  const [calc, setCalc] = useState(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => {
    setCalc(null)
    if (!f.startDate || !(Number(f.businessDays) > 0)) return
    api.get('/mis-vacaciones/calcular', { params: { inicio: f.startDate, dias: f.businessDays } }).then(({ data }) => setCalc(data)).catch(() => {})
  }, [f.startDate, f.businessDays])
  const over = Number(f.businessDays) > available
  const submit = async () => {
    setError('')
    if (!f.startDate) return setError('Indica desde cuándo quieres salir.')
    setSaving(true)
    try { await api.post('/mis-vacaciones/solicitudes', { ...f, businessDays: Number(f.businessDays) }); onSaved() } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title="Solicitar vacaciones" size="sm" onClose={onClose}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={saving || over}>{saving ? <Spinner /> : <MdSend />} Enviar solicitud</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="alert info" style={{ margin: 0 }}><MdInfoOutline /><span>Puedes pedir hasta <b>{days(available)} hábiles</b>. Talento humano la aprueba, la rechaza o te propone otras fechas.</span></div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="field"><label>Salgo a vacaciones</label><input type="date" min={new Date().toISOString().slice(0, 10)} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div className="field"><label>Días hábiles</label><input type="number" min="1" max={Math.floor(available)} step="1" value={f.businessDays} onChange={(e) => setF({ ...f, businessDays: e.target.value })} /></div>
        </div>
        {over && <div className="alert bad" style={{ margin: 0 }}><MdErrorOutline /><span>Superas tus días disponibles.</span></div>}
        {calc && !over && <div className="alert info" style={{ margin: 0 }}><MdInfoOutline /><span>Último día: <b>{fmt(calc.end)}</b>. Regresas el <b>{fmt(calc.returnDate)}</b> (lunes a viernes sin festivos).</span></div>}
        <div className="field"><label>Comentario (opcional)</label><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ej. viaje familiar" /></div>
        {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      </div>
    </Modal>
  )
}

// Tarjeta "Mis solicitudes de vacaciones" (Mi hoja de vida).
export const MyVacationRequests = ({ vacation }) => {
  const [toast, toastNode] = useToast()
  const [list, setList] = useState(null)
  const [asking, setAsking] = useState(false)
  const load = useCallback(() => api.get('/mis-vacaciones/solicitudes', { noCache: true }).then(({ data }) => setList(data)).catch(() => setList([])), [])
  useEffect(() => { load() }, [load])
  if (!vacation?.applies) return null
  const pending = (list || []).filter((r) => r.status === 'pendiente').reduce((a, r) => a + r.businessDays, 0)
  const available = Math.max(0, Math.floor((vacation.balance - pending) * 10) / 10)
  const cancel = async (id) => { try { await api.post(`/mis-vacaciones/solicitudes/${id}/cancelar`); toast('Solicitud cancelada'); load() } catch (e) { toast(errorMessage(e), 'bad') } }
  return (
    <Card title="Mis solicitudes de vacaciones" subtitle={`Disponibles para solicitar: ${days(available)}${pending ? ` (${days(pending)} en trámite)` : ''}`} icon={<MdSend style={{ color: 'var(--brand)' }} />}
      actions={<button type="button" className="btn btn-primary btn-sm" disabled={available < 1} onClick={() => setAsking(true)}><MdAdd /> Solicitar</button>}>
      {!list ? <Spinner /> : list.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>Aún no has solicitado vacaciones.</p> : (
        <ul className="list">{list.map((r) => (
          <li key={r.id}><div className="grow"><strong>{fmt(r.startDate)} al {fmt(r.endDate)} · {days(r.businessDays)}</strong>
            <span><span className={`badge ${REQ_BADGE[r.status]}`}>{r.statusLabel}</span>{r.responseNote ? ` ${r.responseNote}` : ''}{r.decidedBy ? ` · ${r.decidedBy}` : ''}</span></div>
            {r.status === 'pendiente' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => cancel(r.id)}>Cancelar</button>}</li>
        ))}</ul>
      )}
      {asking && <RequestForm available={available} onClose={() => setAsking(false)} onSaved={() => { setAsking(false); toast('Solicitud enviada a talento humano'); load() }} />}
      {toastNode}
    </Card>
  )
}

// Talento humano responde una solicitud: aprobar, rechazar o reprogramar.
const DecideModal = ({ r, onClose, onDone }) => {
  const [action, setAction] = useState('aprobar')
  const [f, setF] = useState({ startDate: r.startDate, businessDays: r.businessDays, note: '' })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async () => {
    setError(''); setSaving(true)
    try { await api.post(`/estandares/th/vacaciones/solicitudes/${r.id}/decidir`, { action, ...f, businessDays: Number(f.businessDays) }); onDone() } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={`Solicitud de ${r.staffName}`} size="sm" onClose={onClose}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className={`btn ${action === 'rechazar' ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Confirmar</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        <p style={{ margin: 0 }}>Pide <b>{days(r.businessDays)}</b> del {fmt(r.startDate)} al {fmt(r.endDate)}.{r.notes ? ` “${r.notes}”` : ''}</p>
        <div className="module-switch inline">
          {[['aprobar', 'Aprobar'], ['reprogramar', 'Reprogramar'], ['rechazar', 'Rechazar']].map(([k, l]) => <button key={k} type="button" className={action === k ? 'on' : ''} onClick={() => setAction(k)}>{l}</button>)}
        </div>
        {action === 'reprogramar' && (
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label>Nueva fecha de salida</label><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
            <div className="field"><label>Días hábiles</label><input type="number" min="1" value={f.businessDays} onChange={(e) => setF({ ...f, businessDays: e.target.value })} /></div>
          </div>
        )}
        <div className="field"><label>{action === 'aprobar' ? 'Nota (opcional)' : action === 'rechazar' ? 'Motivo del rechazo' : 'Motivo de la reprogramación'}</label><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {action !== 'rechazar' && <span className="hint">Al aprobar se registran como disfrute y se descuentan del saldo.</span>}
        {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      </div>
    </Modal>
  )
}

const RequestsPanel = ({ onChanged }) => {
  const [toast, toastNode] = useToast()
  const [list, setList] = useState(null)
  const [status, setStatus] = useState('pendiente')
  const [deciding, setDeciding] = useState(null)
  const load = useCallback(() => api.get('/estandares/th/vacaciones/solicitudes', { params: { ambito: thScope(), estado: status === 'todas' ? undefined : status }, noCache: true }).then(({ data }) => setList(data)).catch(() => setList([])), [status])
  useEffect(() => { load() }, [load])
  return (
    <Card flush title="Solicitudes de vacaciones" icon={<MdEventRepeat style={{ color: 'var(--brand)' }} />}
      actions={<div className="module-switch inline">{[['pendiente', 'Pendientes'], ['todas', 'Todas']].map(([k, l]) => <button key={k} type="button" className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>}>
      {!list ? <div style={{ padding: 16 }}><Spinner /></div> : list.length === 0 ? <Empty icon={<MdEventRepeat />}>{status === 'pendiente' ? 'No hay solicitudes por responder.' : 'Sin solicitudes.'}</Empty> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Persona</th><th>Desde</th><th>Hasta</th><th className="num">Días</th><th>Estado</th><th className="actions" /></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}><td><strong style={{ color: 'var(--ink)' }}>{r.staffName}</strong><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.positionName || ''}{r.notes ? ` · ${r.notes}` : ''}</div></td>
              <td>{fmt(r.startDate)}</td><td>{fmt(r.endDate)}</td><td className="num">{r.businessDays}</td>
              <td><span className={`badge ${REQ_BADGE[r.status]}`}>{r.statusLabel}</span>{r.responseNote ? <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.responseNote}</div> : null}</td>
              <td className="actions">{r.status === 'pendiente' && <button type="button" className="btn btn-outline btn-sm" onClick={() => setDeciding(r)}><MdCheck /> Responder</button>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {deciding && <DecideModal r={deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); toast('Solicitud respondida'); load(); onChanged?.() }} />}
      {toastNode}
    </Card>
  )
}

// Tablero de vacaciones del ámbito (IPS u otras dependencias).
export const VacationsPage = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [only, setOnly] = useState('pendientes')
  const load = useCallback(() => api.get('/estandares/th/vacaciones', { params: { ambito: thScope() }, noCache: true }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => { load() }, [load])
  const list = (rows || []).filter((r) => only === 'todos' || (only === 'pendientes' ? r.vacation.applies && (r.vacation.balance >= 15 || r.vacation.daysToNextPeriod <= 30) : !r.vacation.applies))
    .sort((a, b) => (b.vacation.balance || 0) - (a.vacation.balance || 0))
  return (
    <>
      <PageHead title={`Vacaciones · ${THSCOPE_LABEL[thScope()]}`} subtitle="Saldo de cada persona con contrato laboral: 15 días hábiles por año de servicio (Código Sustantivo del Trabajo)." />
      <div className="module-switch inline" style={{ marginBottom: 14 }}>
        {[['pendientes', 'Con vacaciones pendientes o próximas'], ['todos', 'Todos'], ['no_aplica', 'Sin derecho (OPS, prácticas…)']].map(([k, l]) => <button key={k} type="button" className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{l}</button>)}
      </div>
      {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      <div style={{ marginBottom: 16 }}><RequestsPanel onChanged={load} /></div>
      <Card flush>
        {!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : list.length === 0 ? <Empty icon={<MdBeachAccess />}>Nadie en este filtro.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Persona</th><th>Cargo</th><th>Contrato</th><th className="num">Saldo (días hábiles)</th><th>Próximo periodo</th><th>Próxima salida</th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id} className="th-row" onClick={() => navigate(`${thBase()}/personal/${r.id}`)}>
                <td><strong style={{ color: 'var(--ink)' }}>{r.fullName}</strong><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{[r.dependencyName, r.siteName].filter(Boolean).join(' · ')}</div></td>
                <td>{r.positionName || '—'}</td>
                <td>{r.vacation.applies ? r.vacation.contractTypeLabel : <span style={{ color: 'var(--muted)' }}>{r.vacation.reason}</span>}</td>
                <td className="num">{r.vacation.applies ? <span className={`badge ${r.vacation.balance >= 30 ? 'bad' : r.vacation.balance >= 15 ? 'warn' : ''}`}>{Math.floor(r.vacation.balance * 10) / 10}</span> : '—'}</td>
                <td>{r.vacation.applies ? `${fmt(r.vacation.nextPeriodDate)} (${r.vacation.daysToNextPeriod} d)` : '—'}</td>
                <td>{r.vacation.upcoming ? `${fmt(r.vacation.upcoming.startDate)} · ${r.vacation.upcoming.businessDays} d` : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  )
}
