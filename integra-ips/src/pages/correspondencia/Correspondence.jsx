import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  MdAdd, MdErrorOutline, MdSave, MdMail, MdInbox, MdMarkEmailRead, MdWarning, MdSchedule, MdArrowBack, MdPrint, MdAttachFile,
  MdPhotoCamera, MdSwapHoriz, MdReply, MdNotes, MdDelete, MdCheckCircle, MdTimer, MdDomain
} from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { PageHead, Card, Modal, Empty, Spinner, useToast } from '../../components/ui'
import { SignaturePad } from '../../components/signature'
import { Bars, Donut } from '../academico/EduCharts'
import '../../components/cytology.css'

// IIPS-030 · Gestión documental y correspondencia (ventanilla única).
const TONE = { radicado: 'info', entregado: 'navy', en_revision: 'warn', respondido: 'ok', archivado: '', devuelto: 'bad', anulado: 'bad' }
const DIR = { entrada: 'Entrada', salida: 'Salida', interna: 'Interna' }
const fmtDT = (iso) => (iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(iso)) : '—')
const fmtD = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const readFile = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) })
let catCache = null
const useCatalog = () => {
  const [c, setC] = useState(catCache)
  useEffect(() => { api.get('/correspondencia/catalogos', { noCache: true }).then(({ data }) => { catCache = data; setC(data) }).catch(() => {}) }, [])
  return c
}
const Due = ({ r }) => (r.dueDate ? <span className={`badge ${r.overdue ? 'bad' : r.dueDays <= 3 ? 'warn' : ''}`}><MdTimer /> {r.overdue ? `Vencido ${-r.dueDays} d` : r.dueDays != null ? `${r.dueDays} d hábiles` : fmtD(r.dueDate)}</span> : null)
const Kpi = ({ label, value, foot, icon, tone = '' }) => (
  <div className="card kpi"><div className="kpi-top"><span className="kpi-label">{label}</span><span className={`kpi-icon ${tone}`}>{icon}</span></div><div className="kpi-value" style={{ fontSize: 24 }}>{value ?? '—'}</div>{foot && <div className="kpi-foot">{foot}</div>}</div>
)

// IIPS-036 · Personas del área elegida (miembros y encargado); si el área no tiene personas asignadas, todos.
const areaHasPeople = (cat, areaId) => { const a = cat?.areas.find((x) => String(x.id) === String(areaId)); return Boolean(a && (a.memberIds?.length || a.managerUserId)) }
const peopleOf = (cat, areaId) => {
  const a = cat?.areas.find((x) => String(x.id) === String(areaId))
  if (!a || !areaHasPeople(cat, areaId)) return cat?.users || []
  const ids = new Set([...(a.memberIds || []), a.managerUserId].filter(Boolean))
  return (cat.users || []).filter((u) => ids.has(u.id))
}

// Adjuntar fotos (cámara del celular) o escaneos (PDF).
const FilesPicker = ({ files, onChange }) => {
  const add = async (list) => {
    const out = []
    for (const f of [...list].slice(0, 15)) { if (f.size > 12 * 1024 * 1024) continue; out.push({ name: f.name, data: await readFile(f), kind: f.type === 'application/pdf' ? 'escaneo' : 'foto' }) }
    onChange([...files, ...out])
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="btn btn-outline btn-sm"><MdPhotoCamera /> Tomar foto<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => add(e.target.files)} /></label>
        <label className="btn btn-outline btn-sm"><MdAttachFile /> Adjuntar escaneo o imagen<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => add(e.target.files)} /></label>
      </div>
      {files.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{files.map((f, i) => <span key={i} className="badge">{f.kind === 'foto' ? <MdPhotoCamera /> : <MdAttachFile />} {f.name} <button type="button" aria-label="Quitar" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--bad)' }} onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button></span>)}</div>}
      <span className="hint">Foto del documento, del sobre o de la guía del paquete. PDF o imagen de máximo 12 MB.</span>
    </div>
  )
}

// ---------------------------------------------------------------- Radicar
export const CorrNew = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cat = useCatalog()
  const parentId = params.get('respuesta')
  const [parent, setParent] = useState(null)
  const [f, setF] = useState({ direction: parentId ? 'salida' : 'entrada', kind: 'documento', subject: '', description: '', senderName: '', senderOrg: '', senderDoc: '', senderContact: '', senderAddress: '', carrier: '', trackingNumber: '', folios: '', attachmentsDesc: '', areaId: '', recipientUserId: '', priority: 'normal', requiresResponse: false, responseType: 'peticion', dueDate: '', receivedAt: '' })
  const [files, setFiles] = useState([])
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if (parentId) api.get(`/correspondencia/${parentId}`).then(({ data }) => { setParent(data); setF((x) => ({ ...x, subject: `Respuesta a ${data.code}: ${data.subject}`.slice(0, 300), areaId: String(data.area?.id || ''), senderName: data.sender.name || '', senderOrg: data.sender.org || '', senderContact: data.sender.contact || '', senderAddress: data.sender.address || '' })) }).catch(() => {}) }, [parentId])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = async () => {
    setError('')
    if (!f.subject.trim()) return setError('Escribe el asunto.')
    if (!f.areaId) return setError('Elige el área.')
    setSaving(true)
    try { const { data } = await api.post('/correspondencia', { ...f, files, parentId: parentId || undefined, receivedAt: f.receivedAt || undefined }); navigate(`/correspondencia/${data.id}?nuevo=1`) } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  if (!cat) return <div className="splash"><Spinner /></div>
  const out = f.direction === 'salida'
  return (
    <>
      <PageHead title={parent ? `Responder ${parent.code}` : 'Radicar correspondencia'} subtitle="El consecutivo se asigna por área y año. Lo recibe la persona o el encargado del área en su bandeja." />
      <Card>
        <div className="form-grid corr-form">
          <div className="field"><label>Sentido</label><div className="module-switch inline">{Object.entries(DIR).map(([k, l]) => <button key={k} type="button" className={f.direction === k ? 'on' : ''} onClick={() => setF({ ...f, direction: k })}>{l}</button>)}</div></div>
          <div className="field"><label>Tipo <span className="req">*</span></label><select value={f.kind} onChange={set('kind')}>{Object.entries(cat.kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label>Prioridad</label><select value={f.priority} onChange={set('priority')}><option value="normal">Normal</option><option value="urgente">Urgente</option></select></div>
          <div className="field span-all"><label>Asunto <span className="req">*</span></label><input value={f.subject} onChange={set('subject')} maxLength={300} placeholder="Ej. Solicitud de certificado laboral" /></div>
          <div className="field span-all"><label>Descripción</label><textarea rows={2} value={f.description} onChange={set('description')} /></div>
          <h4 className="span-all" style={{ margin: '6px 0 0' }}>{out ? 'Destinatario externo' : 'Remitente'}</h4>
          <div className="field"><label>Persona</label><input value={f.senderName} onChange={set('senderName')} /></div>
          <div className="field"><label>Entidad o empresa</label><input value={f.senderOrg} onChange={set('senderOrg')} /></div>
          <div className="field"><label>Documento / NIT</label><input value={f.senderDoc} onChange={set('senderDoc')} /></div>
          <div className="field"><label>Teléfono o correo</label><input value={f.senderContact} onChange={set('senderContact')} /></div>
          <div className="field span-2"><label>Dirección</label><input value={f.senderAddress} onChange={set('senderAddress')} /></div>
          <h4 className="span-all" style={{ margin: '6px 0 0' }}>Recepción</h4>
          <div className="field"><label>Transportadora / mensajería</label><input value={f.carrier} onChange={set('carrier')} placeholder="Ej. Servientrega, 4-72, a mano" /></div>
          <div className="field"><label>Número de guía</label><input value={f.trackingNumber} onChange={set('trackingNumber')} /></div>
          <div className="field"><label>Folios</label><input type="number" min="0" value={f.folios} onChange={set('folios')} /></div>
          <div className="field"><label>Fecha y hora de recibido</label><input type="datetime-local" value={f.receivedAt} onChange={set('receivedAt')} /><span className="hint">Vacío = ahora.</span></div>
          <div className="field span-2"><label>Anexos</label><input value={f.attachmentsDesc} onChange={set('attachmentsDesc')} placeholder="Ej. 1 CD, 2 copias de cédula" /></div>
          <h4 className="span-all" style={{ margin: '6px 0 0' }}>Dirigido a</h4>
          <div className="field"><label>Área <span className="req">*</span></label><select value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value, recipientUserId: '' })}><option value="">Selecciona…</option>{cat.areas.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.prefix})</option>)}</select></div>
          <div className="field"><label>Persona</label><select value={f.recipientUserId} onChange={set('recipientUserId')} disabled={!f.areaId}><option value="">{f.areaId ? 'El encargado del área' : 'Elige primero el área'}</option>{peopleOf(cat, f.areaId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            {f.areaId && !areaHasPeople(cat, f.areaId) && <span className="hint">Esta área aún no tiene personas asignadas: se muestran todos. Asígnalas en Áreas y consecutivos.</span>}</div>
          <div className="field span-all"><label className="switch"><input type="checkbox" checked={f.requiresResponse} onChange={set('requiresResponse')} /> Requiere respuesta (con plazo)</label></div>
          {f.requiresResponse && <>
            <div className="field"><label>Término</label><select value={f.responseType} onChange={set('responseType')}>{Object.entries(cat.responseTypes).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field"><label>Vence (opcional)</label><input type="date" value={f.dueDate} onChange={set('dueDate')} /><span className="hint">Vacío = se calcula en días hábiles sin festivos.</span></div>
          </>}
          <div className="field span-all"><label>Fotos y escaneos</label><FilesPicker files={files} onChange={setFiles} /></div>
        </div>
        {error && <div className="alert bad" style={{ marginTop: 12 }}><MdErrorOutline /><span>{error}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Radicar</button>
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- Listados (registro general y mi bandeja)
const CorrTable = ({ rows, navigate }) => (rows.length === 0 ? <Empty icon={<MdInbox />}>Sin radicados en este filtro.</Empty> : (
  <div className="table-wrap"><table className="table">
    <thead><tr><th>Radicado</th><th>Asunto</th><th>Remitente</th><th>Área / destinatario</th><th>Recibido</th><th>Plazo</th><th>Estado</th></tr></thead>
    <tbody>{rows.map((r) => (
      <tr key={r.id} className="th-row" onClick={() => navigate(`/correspondencia/${r.id}`)}>
        <td><strong style={{ color: 'var(--ink)' }}>{r.code}</strong>{r.priority === 'urgente' && <div><span className="badge bad">Urgente</span></div>}</td>
        <td>{r.subject}<div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.kindLabel}{r.trackingNumber ? ` · guía ${r.trackingNumber}` : ''}</div></td>
        <td>{r.sender.org || r.sender.name || '—'}</td><td>{r.area?.name}<div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.recipient?.name || 'Encargado del área'}</div></td>
        <td>{fmtDT(r.receivedAt)}</td><td><Due r={r} /></td><td><span className={`badge ${TONE[r.status]}`}>{r.statusLabel}</span></td>
      </tr>
    ))}</tbody>
  </table></div>
))
const useList = (params) => {
  const [rows, setRows] = useState(null); const [error, setError] = useState('')
  const key = JSON.stringify(params)
  const load = useCallback(() => api.get('/correspondencia', { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)), noCache: true }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  return { rows, error }
}
export const CorrRegister = () => {
  const navigate = useNavigate()
  const cat = useCatalog()
  const [p, setP] = useState({ q: '', estado: 'abiertos', area: '', sentido: '', tipo: '', desde: '', hasta: '', vencidos: '' })
  const { rows, error } = useList(p)
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value })
  return (
    <>
      <PageHead title="Registro de correspondencia" subtitle="Todo lo radicado: entradas, salidas e internas, con su estado y plazo."><Link className="btn btn-primary" to="/correspondencia/radicar"><MdAdd /> Radicar</Link></PageHead>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input value={p.q} onChange={set('q')} placeholder="Buscar radicado, asunto, remitente o guía" style={{ minWidth: 240 }} />
        <select value={p.estado} onChange={set('estado')}><option value="abiertos">Abiertos</option><option value="">Todos</option>{cat && Object.entries(cat.statuses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={p.area} onChange={set('area')}><option value="">Todas las áreas</option>{cat?.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={p.sentido} onChange={set('sentido')}><option value="">Todo sentido</option>{Object.entries(DIR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input type="date" value={p.desde} onChange={set('desde')} aria-label="Desde" /><input type="date" value={p.hasta} onChange={set('hasta')} aria-label="Hasta" />
        <label className="switch"><input type="checkbox" checked={p.vencidos === '1'} onChange={set('vencidos')} /> Solo vencidos</label>
      </div>
      {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      <Card flush>{!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : <CorrTable rows={rows} navigate={navigate} />}</Card>
    </>
  )
}
export const CorrInbox = () => {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('abiertos')
  const { rows, error } = useList({ bandeja: 'mia', estado })
  return (
    <>
      <PageHead title="Mi correspondencia" subtitle="Lo que te radicaron: revísalo, responde o archívalo." />
      <div className="module-switch inline" style={{ marginBottom: 14 }}>{[['abiertos', 'Pendientes'], ['', 'Todos'], ['respondido', 'Respondidos'], ['archivado', 'Archivados']].map(([k, l]) => <button key={k} type="button" className={estado === k ? 'on' : ''} onClick={() => setEstado(k)}>{l}</button>)}</div>
      {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
      <Card flush>{!rows ? <div className="splash" style={{ minHeight: 160 }}><Spinner /></div> : <CorrTable rows={rows} navigate={navigate} />}</Card>
    </>
  )
}

// ---------------------------------------------------------------- Detalle, trazabilidad y acciones
const ACTION = { radicado: 'Radicado', entregado: 'Entregado', en_revision: 'En revisión', respondido: 'Respondido', archivado: 'Archivado', devuelto: 'Devuelto', anulado: 'Anulado', reasignado: 'Reasignado', archivo: 'Archivos agregados', nota: 'Anotación' }
export const CorrDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { logo, settings } = useSettings()
  const cat = useCatalog()
  const [toast, toastNode] = useToast()
  const [c, setC] = useState(null); const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [files, setFiles] = useState([])
  const [label, setLabel] = useState(false)
  const load = useCallback(() => api.get(`/correspondencia/${id}`, { noCache: true }).then(({ data }) => setC(data)).catch((e) => setError(errorMessage(e))), [id])
  useEffect(() => { load() }, [load])
  const act = async (fn, msg) => { try { await fn(); setModal(null); setForm({}); setFiles([]); toast(msg); load() } catch (e) { toast(errorMessage(e), 'bad') } }
  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!c) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const next = c.can.next || []
  const state = (s, msg) => act(() => api.post(`/correspondencia/${c.id}/estado`, { status: s, ...form }), msg)
  if (label) {
    return (
      <div className="cy-detail-page">
        <div className="cy-toolbar no-print"><button type="button" className="btn btn-outline" onClick={() => setLabel(false)}><MdArrowBack /> Volver</button><button type="button" className="btn btn-primary" onClick={() => window.print()}><MdPrint /> Imprimir rótulo</button></div>
        <article className="cy-sheet" style={{ maxWidth: '100mm', padding: '6mm', border: '1px dashed #999', textAlign: 'center' }}>
          <img src={logo} alt="" style={{ maxHeight: 34 }} /><div style={{ fontSize: 10, color: '#555' }}>{settings.ipsName}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.04em', margin: '3mm 0' }}>{c.code}</div>
          <div style={{ fontSize: 11 }}>Recibido: {fmtDT(c.receivedAt)}</div>
          <div style={{ fontSize: 11 }}>Para: {c.area?.name}{c.recipient ? ` · ${c.recipient.name}` : ''}</div>
          <div style={{ fontSize: 11 }}>{c.folios ? `${c.folios} folio(s)` : ''}{c.dueDate ? ` · Responder antes del ${fmtD(c.dueDate)}` : ''}</div>
          <div style={{ fontSize: 10, color: '#555', marginTop: '2mm' }}>Radicó: {c.createdBy}</div>
        </article>
      </div>
    )
  }
  return (
    <>
      <div style={{ marginBottom: 12 }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><MdArrowBack /> Volver</button></div>
      <PageHead title={`${c.code} · ${c.subject}`} subtitle={`${DIR[c.direction]} · ${c.kindLabel} · ${c.area?.name}${c.recipient ? ` · ${c.recipient.name}` : ' · encargado del área'}`}>
        <span className={`badge ${TONE[c.status]}`} style={{ alignSelf: 'center' }}>{c.statusLabel}</span>
        <button type="button" className="btn btn-outline" onClick={() => setLabel(true)}><MdPrint /> Rótulo</button>
      </PageHead>
      {c.overdue && <div className="alert bad" style={{ marginBottom: 12 }}><MdWarning /><span>El plazo de respuesta venció el {fmtD(c.dueDate)}.</span></div>}
      {c.can.act && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {next.includes('entregado') && <button type="button" className="btn btn-primary" onClick={() => setModal('entregar')}><MdMarkEmailRead /> Entregar con firma de recibido</button>}
          {next.includes('en_revision') && <button type="button" className="btn btn-outline" onClick={() => state('en_revision', 'Marcado en revisión')}><MdSchedule /> En revisión</button>}
          {['radicado', 'entregado', 'en_revision'].includes(c.status) && <Link className="btn btn-outline" to={`/correspondencia/radicar?respuesta=${c.id}`}><MdReply /> Responder (radicar salida)</Link>}
          {next.includes('respondido') && <button type="button" className="btn btn-outline" onClick={() => setModal('respondido')}><MdCheckCircle /> Marcar respondido</button>}
          {next.includes('archivado') && <button type="button" className="btn btn-outline" onClick={() => setModal('archivado')}>Archivar</button>}
          {['radicado', 'entregado', 'en_revision', 'devuelto'].includes(c.status) && <button type="button" className="btn btn-ghost" onClick={() => setModal('reasignar')}><MdSwapHoriz /> Reasignar</button>}
          {next.includes('devuelto') && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => setModal('devuelto')}>Devolver</button>}
          {next.includes('anulado') && user.role === 'administrador' && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => setModal('anulado')}><MdDelete /> Anular</button>}
          <button type="button" className="btn btn-ghost" onClick={() => setModal('archivos')}><MdAttachFile /> Adjuntar</button>
          <button type="button" className="btn btn-ghost" onClick={() => setModal('nota')}><MdNotes /> Anotación</button>
        </div>
      )}
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card title="Datos">
          <ul className="list">
            {[['Remitente', [c.sender.name, c.sender.org].filter(Boolean).join(' · ') || '—'], ['Documento / NIT', c.sender.doc], ['Contacto', c.sender.contact], ['Dirección', c.sender.address], ['Transportadora y guía', [c.carrier, c.trackingNumber].filter(Boolean).join(' · ')], ['Folios y anexos', [c.folios && `${c.folios} folio(s)`, c.attachmentsDesc].filter(Boolean).join(' · ')], ['Recibido', fmtDT(c.receivedAt)], ['Radicó', c.createdBy], ['Plazo de respuesta', c.requiresResponse ? `${fmtD(c.dueDate)}${c.dueDays != null ? ` (${c.overdue ? `vencido hace ${-c.dueDays}` : `${c.dueDays}`} días hábiles)` : ''}` : 'No requiere respuesta'], ['Entregado', c.deliveredAt ? `${fmtDT(c.deliveredAt)} a ${c.deliveredTo}` : '—']].map(([l, v]) => <li key={l}><div className="grow"><strong>{l}</strong><span>{v || '—'}</span></div></li>)}
          </ul>
          {c.description && <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>}
          {c.deliverySignatureUrl && <div><span className="label">Firma de recibido</span><img src={c.deliverySignatureUrl} alt="Firma de recibido" style={{ maxHeight: 70, display: 'block' }} /></div>}
          {c.parent && <p>Responde a <Link to={`/correspondencia/${c.parent.id}`}>{c.parent.code}</Link> · {c.parent.subject}</p>}
          {c.children.length > 0 && <div><span className="label">Respuestas y documentos vinculados</span>{c.children.map((x) => <div key={x.id}><Link to={`/correspondencia/${x.id}`}>{x.code}</Link> · {x.subject} <span className={`badge ${TONE[x.status]}`}>{x.statusLabel}</span></div>)}</div>}
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card title={`Archivos (${c.files.length})`}>
            {c.files.length === 0 ? <span className="hint">Sin archivos.</span> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {c.files.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 6, textAlign: 'center', fontSize: 11.5, textDecoration: 'none', color: 'var(--ink)' }}>{f.mime?.startsWith('image/') ? <img src={f.url} alt={f.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} /> : <MdAttachFile style={{ fontSize: 40 }} />}<div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div></a>)}
              </div>
            )}
          </Card>
          <Card title="Trazabilidad">
            <ul className="list">{c.events.map((e) => <li key={e.id}><div className="grow"><strong>{ACTION[e.action] || e.action}{e.toUser || e.toArea ? ` → ${[e.toArea, e.toUser].filter(Boolean).join(' · ')}` : ''}</strong><span>{fmtDT(e.at)} · {e.user || '—'}{e.note ? ` · ${e.note}` : ''}</span></div></li>)}</ul>
          </Card>
        </div>
      </div>
      {modal === 'entregar' && (
        <Modal title="Entregar con firma de recibido" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => state('entregado', 'Entregado')}><MdMarkEmailRead /> Confirmar entrega</button></>}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="field"><label>Recibe</label><input value={form.deliveredTo || ''} onChange={(e) => setForm({ ...form, deliveredTo: e.target.value })} placeholder={c.recipient?.name || 'Nombre de quien recibe'} /></div>
            <div className="field"><label>Firma de quien recibe</label><SignaturePad onChange={(sig) => setForm((x) => ({ ...x, signature: sig }))} /></div>
          </div>
        </Modal>
      )}
      {['respondido', 'archivado', 'devuelto', 'anulado'].includes(modal) && (
        <Modal title={{ respondido: 'Marcar respondido', archivado: 'Archivar', devuelto: 'Devolver a recepción', anulado: 'Anular radicado' }[modal]} size="sm" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => state(modal, 'Estado actualizado')}>Confirmar</button></>}>
          <div className="field"><label>{['devuelto', 'anulado'].includes(modal) ? 'Motivo *' : 'Observación'}</label><textarea rows={3} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={modal === 'respondido' ? 'Ej. Se respondió por correo el…' : ''} /></div>
        </Modal>
      )}
      {modal === 'reasignar' && cat && (
        <Modal title="Reasignar" size="sm" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => act(() => api.post(`/correspondencia/${c.id}/reasignar`, form), 'Reasignado')}><MdSwapHoriz /> Reasignar</button></>}>
          <div className="stack" style={{ gap: 12 }}>
            <div className="field"><label>Área</label><select value={form.areaId || c.area?.id || ''} onChange={(e) => setForm({ ...form, areaId: e.target.value, userId: '' })}>{cat.areas.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            {cat.users.length > 0 && <div className="field"><label>Persona</label><select value={form.userId || ''} onChange={(e) => setForm({ ...form, userId: e.target.value })}><option value="">El encargado del área</option>{peopleOf(cat, form.areaId || c.area?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
            <div className="field"><label>Motivo *</label><textarea rows={2} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
        </Modal>
      )}
      {modal === 'archivos' && (
        <Modal title="Adjuntar archivos" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="btn btn-primary" disabled={!files.length} onClick={() => act(() => api.post(`/correspondencia/${c.id}/archivos`, { files }), 'Archivos agregados')}><MdSave /> Guardar</button></>}>
          <FilesPicker files={files} onChange={setFiles} />
        </Modal>
      )}
      {modal === 'nota' && (
        <Modal title="Anotación" size="sm" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => act(() => api.post(`/correspondencia/${c.id}/nota`, form), 'Anotación guardada')}><MdSave /> Guardar</button></>}>
          <div className="field"><label>Anotación</label><textarea rows={3} value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </Modal>
      )}
      {toastNode}
    </>
  )
}

// ---------------------------------------------------------------- Dashboard
export const CorrDashboard = () => {
  const navigate = useNavigate()
  const [d, setD] = useState(null); const [error, setError] = useState('')
  useEffect(() => { api.get('/correspondencia-resumen', { noCache: true }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e))) }, [])
  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!d) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const k = d.kpis
  return (
    <>
      <PageHead title="Gestión documental" subtitle="Correspondencia de los últimos 6 meses: radicados, plazos, áreas y tiempos de respuesta."><Link className="btn btn-primary" to="/correspondencia/radicar"><MdAdd /> Radicar</Link></PageHead>
      <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Radicados este mes" value={k.month} icon={<MdMail />} tone="navy" />
        <Kpi label="Abiertos" value={k.open} icon={<MdInbox />} foot={`${k.undelivered} sin entregar`} />
        <Kpi label="Vencidos" value={k.overdue} icon={<MdWarning />} tone="bad" foot={`${k.dueSoon} vencen en 3 días hábiles`} />
        <Kpi label="Respuesta promedio" value={k.avgResponseDays != null ? `${k.avgResponseDays} d` : '—'} icon={<MdTimer />} tone="ok" foot={k.onTimePct != null ? `${k.onTimePct} % a tiempo` : 'Sin respuestas aún'} />
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
        <Card title="Radicados por mes"><Bars data={d.months} xKey="label" keys={[{ key: 'entrada', name: 'Entrada', color: '#2563EB' }, { key: 'salida', name: 'Salida', color: '#16A34A' }, { key: 'interna', name: 'Interna', color: '#F59E0B' }]} /></Card>
        <Card title="Por estado"><Donut data={d.byStatus} /></Card>
        <Card title="Por área" icon={<MdDomain />}><Donut data={d.byArea} /></Card>
        <Card flush title="Vencidos">{d.overdue.length === 0 ? <Empty icon={<MdCheckCircle />}>Nada vencido.</Empty> : <ul className="list" style={{ padding: '4px 20px' }}>{d.overdue.map((r) => <li key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/correspondencia/${r.id}`)}><div className="grow"><strong>{r.code} · {r.subject}</strong><span>{r.area?.name} · {r.recipient?.name || 'encargado'} · vencido hace {-r.dueDays} d</span></div></li>)}</ul>}</Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Áreas (configuración)
export const CorrAreas = () => {
  const [toast, toastNode] = useToast()
  const [d, setD] = useState(null)
  const [f, setF] = useState({ name: '', prefix: '' })
  const [members, setMembers] = useState(null)
  const load = () => api.get('/correspondencia/catalogos', { noCache: true }).then(({ data }) => { catCache = data; setD(data) }).catch(() => {})
  useEffect(() => { load() }, [])
  const save = async (fn, msg) => { try { await fn(); toast(msg); load() } catch (e) { toast(errorMessage(e), 'bad') } }
  const users = useMemo(() => d?.users || [], [d])
  if (!d) return <div className="splash"><Spinner /></div>
  return (
    <>
      <PageHead title="Áreas de correspondencia" subtitle="Cada área tiene su prefijo para el consecutivo (ENT-TH-2026-0001) y un encargado que recibe lo que no va a una persona." />
      <Card flush>
        <div className="table-wrap"><table className="table"><thead><tr><th>Área</th><th>Prefijo</th><th>Encargado</th><th>Personas del área</th><th>Activa</th></tr></thead>
          <tbody>{d.areas.map((a) => <tr key={a.id}><td>{a.name}</td><td><b>{a.prefix}</b></td>
            <td><select value={a.managerUserId || ''} onChange={(e) => save(() => api.put(`/correspondencia/areas/${a.id}`, { managerUserId: e.target.value }), 'Encargado actualizado')}><option value="">Sin encargado</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
            <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setMembers({ area: a, ids: new Set(a.memberIds || []) })}>{a.memberIds?.length ? `${a.memberIds.length} persona(s)` : 'Asignar personas'}</button></td>
            <td><label className="switch"><input type="checkbox" checked={a.active} onChange={(e) => save(() => api.put(`/correspondencia/areas/${a.id}`, { active: e.target.checked }), 'Área actualizada')} /></label></td></tr>)}</tbody></table></div>
      </Card>
      <div style={{ marginTop: 16 }}><Card title="Nueva área">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nombre (ej. Jurídica)" />
          <input value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase().slice(0, 6) })} placeholder="Prefijo (ej. JUR)" style={{ width: 120 }} />
          <button type="button" className="btn btn-primary" onClick={() => save(() => api.post('/correspondencia/areas', f), 'Área creada').then(() => setF({ name: '', prefix: '' }))}><MdAdd /> Agregar</button>
        </div>
      </Card></div>
      {members && (
        <Modal title={`Personas de ${members.area.name}`} onClose={() => setMembers(null)} footer={<><button type="button" className="btn btn-outline" onClick={() => setMembers(null)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => save(() => api.put(`/correspondencia/areas/${members.area.id}/miembros`, { userIds: [...members.ids] }), 'Personas del área guardadas').then(() => setMembers(null))}><MdSave /> Guardar</button></>}>
          <p className="hint" style={{ marginTop: 0 }}>Al radicar para esta área solo se ofrecerán estas personas (y el encargado).</p>
          <div className="stack" style={{ gap: 4, maxHeight: 380, overflowY: 'auto' }}>
            {users.map((u) => <label key={u.id} className={`rc-check${members.ids.has(u.id) ? ' on' : ''}`}><input type="checkbox" checked={members.ids.has(u.id)} onChange={(e) => { const ids = new Set(members.ids); if (e.target.checked) ids.add(u.id); else ids.delete(u.id); setMembers({ ...members, ids }) }} /> {u.name}</label>)}
          </div>
        </Modal>
      )}
      {toastNode}
    </>
  )
}
