import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdAdd, MdEdit, MdDelete, MdPrint, MdArrowBack, MdErrorOutline, MdSave, MdEventNote, MdPlayArrow, MdSend, MdCheckCircle, MdCancel, MdRestore } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { PageHead, Card, Modal, Empty, Spinner, useToast } from '../../components/ui'
import { PersonLookup, fmtDateTime } from './common'
import { toLocalInput } from '../../components/ManualDateTime'
import '../../components/cytology.css'

// IIPS-025 · Eventos previos: programación de servicios, actividades de educación y traslados que un cliente
// contrata con anticipación. Generan la cotización y luego se cargan en el evento o traslado real.
const TONE = { borrador: '', cotizado: 'info', aprobado: 'ok', ejecutado: 'navy', cancelado: 'bad' }
const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const EMPTY = { area: 'socorro', name: '', description: '', place: '', siteId: '', startsAt: '', endsAt: '', attendees: '', client: { name: '', nit: '', contact: '', phone: '', email: '' }, coordinatorId: null, needsDriver: false, vehicles: [], personnel: [], elements: [], priceItems: [], notes: '', validUntil: '' }

const Rows = ({ label, rows, onChange, cols, empty, add }) => (
  <div className="field span-all">
    <label>{label}</label>
    {rows.length === 0 && <span className="hint">{empty}</span>}
    {rows.map((r, i) => (
      <div key={i} style={{ display: 'grid', gridTemplateColumns: `${cols.map((c) => c.w || '1fr').join(' ')} auto`, gap: 6, marginBottom: 6 }}>
        {cols.map((c) => c.options
          ? <select key={c.k} value={r[c.k] ?? ''} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)))} aria-label={c.label}>{c.blank && <option value="">{c.blank}</option>}{Object.entries(c.options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          : <input key={c.k} type={c.type || 'text'} min={c.type === 'number' ? 0 : undefined} value={r[c.k] ?? ''} placeholder={c.label} aria-label={c.label} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)))} />)}
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" style={{ color: 'var(--bad)' }} onClick={() => onChange(rows.filter((_, j) => j !== i))}><MdDelete /></button>
      </div>
    ))}
    <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...rows, add])}><MdAdd /> Agregar</button>
  </div>
)

export const PlannedForm = ({ initial, onClose, onSaved }) => {
  const { user } = useAuth()
  const editing = Boolean(initial?.id)
  const [cat, setCat] = useState(null)
  const [sites, setSites] = useState([])
  const [f, setF] = useState(() => (editing ? {
    ...EMPTY, ...initial, siteId: initial.siteId || '', startsAt: toLocalInput(initial.startsAt) || '', endsAt: toLocalInput(initial.endsAt) || '', attendees: initial.attendees ?? '',
    coordinatorId: initial.coordinator?.id || null, priceItems: initial.priceItems.map(({ total, ...x }) => x), validUntil: initial.validUntil || ''
  } : { ...EMPTY }))
  const [coordinator, setCoordinator] = useState(initial?.coordinator || null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.get('/eventos-previos/catalogos').then(({ data }) => setCat(data)).catch(() => {})
    if (user.role === 'administrador') api.get('/sedes', { params: { sede: undefined } }).then(({ data }) => setSites(data)).catch(() => {})
  }, [user.role])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setC = (k) => (e) => setF({ ...f, client: { ...f.client, [k]: e.target.value } })
  const total = f.priceItems.reduce((a, x) => a + (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0), 0)
  const submit = async (status) => {
    setError('')
    if (!f.name.trim()) return setError('Escribe el nombre de la actividad.')
    if (!f.startsAt) return setError('Indica la fecha y hora de inicio.')
    setSaving(true)
    try {
      const body = { ...f, coordinatorId: coordinator?.id || null, status }
      const { data } = editing ? await api.put(`/eventos-previos/${initial.id}`, body) : await api.post('/eventos-previos', body)
      onSaved(data)
    } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  if (!cat) return <Modal title="Evento programado" onClose={onClose}><Spinner /></Modal>
  return (
    <Modal title={editing ? `Editar ${initial.code}` : 'Nuevo evento programado'} size="lg" onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
        {!editing && <button type="button" className="btn btn-outline" onClick={() => submit('borrador')} disabled={saving}><MdSave /> Guardar borrador</button>}
        <button type="button" className="btn btn-primary" onClick={() => submit('cotizado')} disabled={saving}>{saving ? <Spinner /> : editing ? <MdSave /> : <MdSend />} {editing ? 'Guardar cambios' : 'Guardar y cotizar'}</button>
      </>}>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="field span-all"><label>Tipo <span className="req">*</span></label>
          <div className="module-switch inline">{Object.entries(cat.areas).map(([k, l]) => <button key={k} type="button" className={f.area === k ? 'on' : ''} onClick={() => setF({ ...f, area: k })}>{l}</button>)}</div></div>
        <div className="field span-all"><label>Actividad <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder="Ej. Cubrimiento médico del Festival Vallenato" maxLength={160} /></div>
        <div className="field span-all"><label>Descripción</label><textarea rows={2} value={f.description} onChange={set('description')} placeholder="Qué se hará, condiciones, horarios por jornada…" /></div>
        <div className="field"><label>Inicio <span className="req">*</span></label><input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></div>
        <div className="field"><label>Terminación</label><input type="datetime-local" value={f.endsAt} onChange={set('endsAt')} min={f.startsAt || undefined} /></div>
        <div className="field"><label>Lugar</label><input value={f.place} onChange={set('place')} placeholder="Dirección o sitio" /></div>
        <div className="field"><label>Personas que se atienden o asisten</label><input type="number" min="0" value={f.attendees} onChange={set('attendees')} /></div>
        {user.role === 'administrador' && <div className="field"><label>Sede</label><select value={f.siteId} onChange={set('siteId')}><option value="">Sin sede definida</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
        <div className="field"><label className="switch" style={{ marginTop: 26 }}><input type="checkbox" checked={f.needsDriver} onChange={set('needsDriver')} /> Requiere conductor</label></div>

        <h4 className="span-all" style={{ margin: '8px 0 0' }}>Cliente</h4>
        <div className="field"><label>Empresa o persona</label><input value={f.client.name} onChange={setC('name')} /></div>
        <div className="field"><label>NIT / documento</label><input value={f.client.nit} onChange={setC('nit')} /></div>
        <div className="field"><label>Contacto</label><input value={f.client.contact} onChange={setC('contact')} /></div>
        <div className="field"><label>Teléfono</label><input value={f.client.phone} onChange={setC('phone')} /></div>
        <div className="field span-all"><label>Correo</label><input type="email" value={f.client.email} onChange={setC('email')} /></div>

        <h4 className="span-all" style={{ margin: '8px 0 0' }}>Personal, vehículos y elementos</h4>
        <div className="span-all">{coordinator ? <div className="picked-user"><span>Coordinador: <b>{coordinator.fullName}</b></span><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCoordinator(null)}>Cambiar</button></div> : <PersonLookup label="Coordinador de la actividad (carnet o documento)" onFound={setCoordinator} />}</div>
        <Rows label="Personal requerido" rows={f.personnel} onChange={(v) => setF({ ...f, personnel: v })} empty="Ej. 6 voluntarios de Socorrismo, 1 médico."
          cols={[{ k: 'role', label: 'Cargo (voluntario, médico, auxiliar…)', w: '2fr' }, { k: 'agrupacion', label: 'Agrupación', options: Object.fromEntries(cat.agrupaciones.map((a) => [a, a])), blank: 'Cualquier agrupación' }, { k: 'quantity', label: 'Cantidad', type: 'number', w: '90px' }]} add={{ role: 'Voluntario', agrupacion: '', quantity: 1 }} />
        <Rows label="Vehículos" rows={f.vehicles} onChange={(v) => setF({ ...f, vehicles: v })} empty="Ambulancias TAB/TAM u otros vehículos."
          cols={[{ k: 'type', label: 'Tipo', options: cat.vehicleTypes }, { k: 'quantity', label: 'Cantidad', type: 'number', w: '90px' }, { k: 'notes', label: 'Observación', w: '2fr' }]} add={{ type: 'TAB', quantity: 1, notes: '' }} />
        <Rows label="Elementos que requiere" rows={f.elements} onChange={(v) => setF({ ...f, elements: v })} empty="Ej. 2 camillas, 1 botiquín tipo A, 1 carpa."
          cols={[{ k: 'name', label: 'Elemento', w: '2fr' }, { k: 'quantity', label: 'Cantidad', type: 'number', w: '90px' }]} add={{ name: '', quantity: 1 }} />

        <h4 className="span-all" style={{ margin: '8px 0 0' }}>Cotización</h4>
        <Rows label="Conceptos" rows={f.priceItems} onChange={(v) => setF({ ...f, priceItems: v })} empty="Agrega los conceptos con su valor unitario."
          cols={[{ k: 'concept', label: 'Concepto', w: '2fr' }, { k: 'quantity', label: 'Cant.', type: 'number', w: '80px' }, { k: 'unitPrice', label: 'Valor unitario', type: 'number', w: '140px' }]} add={{ concept: '', quantity: 1, unitPrice: '' }} />
        <div className="field"><label>Válida hasta</label><input type="date" value={f.validUntil} onChange={set('validUntil')} /></div>
        <div className="field"><label>Total</label><input value={money(total)} readOnly /></div>
        <div className="field span-all"><label>Notas y condiciones</label><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Forma de pago, qué incluye, qué no incluye…" /></div>
      </div>
      {error && <div className="alert bad" style={{ marginTop: 14 }}><MdErrorOutline /><span>{error}</span></div>}
    </Modal>
  )
}

export const PlannedEventsPage = () => {
  const [toast, toastNode] = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ area: '', estado: '' })
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const load = useCallback(() => api.get('/eventos-previos', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), noCache: true }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), [filters])
  useEffect(() => { load() }, [load])
  const AREAS = { socorro: 'Socorro', educacion: 'Educación', traslado: 'Traslado' }
  return (
    <>
      <PageHead title="Eventos programados" subtitle="Servicios, actividades de educación y traslados que los clientes contratan con anticipación, con su cotización.">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><MdAdd /> Programar evento</button>
      </PageHead>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(AREAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={filters.estado} onChange={(e) => setFilters({ ...filters, estado: e.target.value })} aria-label="Estado"><option value="">Todos los estados</option>{['borrador', 'cotizado', 'aprobado', 'ejecutado', 'cancelado'].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select>
      </div>
      {error && <div className="alert bad" style={{ marginBottom: 16 }}><MdErrorOutline /><span>{error}</span></div>}
      <Card flush>
        {!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : rows.length === 0 ? <Empty icon={<MdEventNote />}>No hay eventos programados.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Código</th><th>Actividad</th><th>Tipo</th><th>Inicio</th><th>Cliente</th><th className="num">Personal</th><th className="num">Total</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/socorro/programacion/${r.id}`)}>
                <td><strong style={{ color: 'var(--ink)' }}>{r.code}</strong></td><td>{r.name}<div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.place || ''}</div></td>
                <td>{AREAS[r.area]}</td><td>{fmtDateTime(r.startsAt)}</td><td>{r.client.name || '—'}</td><td className="num">{r.volunteersTotal || '—'}</td><td className="num">{r.total ? money(r.total) : '—'}</td>
                <td><span className={`badge ${TONE[r.status]}`}>{r.statusLabel}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {creating && <PlannedForm onClose={() => setCreating(false)} onSaved={(d) => { setCreating(false); toast('Evento programado'); navigate(`/socorro/programacion/${d.id}`) }} />}
      {toastNode}
    </>
  )
}

// Detalle y cotización imprimible.
export const PlannedEventDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { logo, settings } = useSettings()
  const [toast, toastNode] = useToast()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const load = useCallback(() => api.get(`/eventos-previos/${id}`, { noCache: true }).then(({ data }) => setP(data)).catch((e) => setError(errorMessage(e))), [id])
  useEffect(() => { load() }, [load])
  const status = async (s, msg) => { try { const { data } = await api.post(`/eventos-previos/${id}/estado`, { status: s }); setP(data); toast(msg) } catch (e) { toast(errorMessage(e), 'bad') } }
  const remove = async () => { try { await api.delete(`/eventos-previos/${id}`); navigate('/socorro/programacion') } catch (e) { toast(errorMessage(e), 'bad') } }
  const startPath = useMemo(() => (p ? (p.area === 'traslado' ? `/traslado-asistencial?programado=${p.id}` : `/socorro/${p.area === 'educacion' ? 'educacion' : 'eventos'}?programado=${p.id}`) : '#'), [p])
  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!p) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const open = ['borrador', 'cotizado', 'aprobado'].includes(p.status)
  return (
    <div className="cy-detail-page">
      <div className="cy-toolbar no-print" style={{ flexWrap: 'wrap', gap: 8 }}>
        <Link to="/socorro/programacion" className="btn btn-outline"><MdArrowBack /> Programación</Link>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {open && <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}><MdEdit /> Editar</button>}
          {p.status === 'borrador' && <button type="button" className="btn btn-outline" onClick={() => status('cotizado', 'Marcado como cotizado')}><MdSend /> Marcar cotizado</button>}
          {p.status === 'cotizado' && <button type="button" className="btn btn-outline" onClick={() => status('aprobado', 'Aprobado por el cliente')}><MdCheckCircle /> Cliente aprobó</button>}
          {open && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => status('cancelado', 'Cancelado')}><MdCancel /> Cancelar</button>}
          {p.status === 'cancelado' && <button type="button" className="btn btn-ghost" onClick={() => status('borrador', 'Reabierto como borrador')}><MdRestore /> Reabrir</button>}
          {['borrador', 'cancelado'].includes(p.status) && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)' }} onClick={remove}><MdDelete /> Eliminar</button>}
          {['cotizado', 'aprobado'].includes(p.status) && <Link className="btn btn-primary" to={startPath}><MdPlayArrow /> {p.area === 'traslado' ? 'Iniciar traslado' : 'Iniciar evento'}</Link>}
          {p.event && <Link className="btn btn-outline" to={`/socorro/${p.event.area === 'educacion' ? 'educacion' : 'eventos'}/${p.event.id}`}>Ver evento {p.event.code}</Link>}
          {p.trip && <Link className="btn btn-outline" to={`/socorro/vehiculos/reportes/${p.trip.id}`}>Ver traslado {p.trip.code}</Link>}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}><MdPrint /> Cotización PDF</button>
        </div>
      </div>
      <article className="cy-sheet ev-sheet">
        <header className="cy-sheet-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <img src={logo} alt={settings.ipsName} style={{ maxHeight: 56 }} />
          <div style={{ textAlign: 'right' }}><h2 style={{ margin: 0 }}>Cotización {p.code}</h2><small>{p.areaLabel} · <span className={`badge ${TONE[p.status]}`}>{p.statusLabel}</span></small></div>
        </header>
        <section className="cy-section">
          <h3 className="cy-section-title">Cliente</h3>
          <div className="cy-grid">
            {[['Empresa o persona', p.client.name], ['NIT / documento', p.client.nit], ['Contacto', p.client.contact], ['Teléfono', p.client.phone], ['Correo', p.client.email]].map(([l, v]) => <div key={l} className="cy-field"><span className="cy-field-label">{l}</span><span className="cy-field-value">{v || '—'}</span></div>)}
          </div>
        </section>
        <section className="cy-section">
          <h3 className="cy-section-title">Actividad</h3>
          <div className="cy-grid">
            {[['Actividad', p.name], ['Lugar', p.place], ['Inicio', fmtDateTime(p.startsAt)], ['Terminación', p.endsAt ? fmtDateTime(p.endsAt) : '—'], ['Personas que se atienden', p.attendees ?? '—'], ['Coordinador', p.coordinator?.fullName], ['Requiere conductor', p.needsDriver ? 'Sí' : 'No']].map(([l, v]) => <div key={l} className="cy-field"><span className="cy-field-label">{l}</span><span className="cy-field-value">{v || '—'}</span></div>)}
          </div>
          {p.description && <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{p.description}</p>}
        </section>
        {(p.personnel.length > 0 || p.vehicles.length > 0 || p.elements.length > 0) && (
          <section className="cy-section ev-table-section">
            <h3 className="cy-section-title">Recursos</h3>
            <table className="ev-table"><thead><tr><th>Recurso</th><th>Detalle</th><th>Cantidad</th></tr></thead>
              <tbody>
                {p.personnel.map((x, i) => <tr key={`p${i}`}><td>{x.role}</td><td>{x.agrupacion || 'Personal'}</td><td>{x.quantity}</td></tr>)}
                {p.vehicles.map((x, i) => <tr key={`v${i}`}><td>{x.type === 'otro' ? 'Vehículo' : `Ambulancia ${x.type}`}</td><td>{x.notes || '—'}</td><td>{x.quantity}</td></tr>)}
                {p.elements.map((x, i) => <tr key={`e${i}`}><td>{x.name}</td><td>Elemento</td><td>{x.quantity}</td></tr>)}
              </tbody>
            </table>
          </section>
        )}
        <section className="cy-section ev-table-section">
          <h3 className="cy-section-title">Valores</h3>
          {p.priceItems.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>Sin valores registrados.</p> : (
            <table className="ev-table"><thead><tr><th>Concepto</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th></tr></thead>
              <tbody>{p.priceItems.map((x, i) => <tr key={i}><td>{x.concept}</td><td>{x.quantity}</td><td>{money(x.unitPrice)}</td><td>{money(x.total)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td><td style={{ fontWeight: 700 }}>{money(p.total)}</td></tr></tfoot>
            </table>
          )}
          {p.validUntil && <p style={{ margin: '8px 0 0' }}>Cotización válida hasta el {p.validUntil.split('-').reverse().join('/')}.</p>}
          {p.notes && <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
        </section>
        <footer className="cy-sheet-footer"><span>{settings.ipsName}</span><span>Elaboró: {p.createdBy || '—'} · {fmtDateTime(p.createdAt)}</span></footer>
      </article>
      {editing && <PlannedForm initial={p} onClose={() => setEditing(false)} onSaved={(d) => { setEditing(false); setP(d); toast('Cambios guardados') }} />}
      {toastNode}
    </div>
  )
}
