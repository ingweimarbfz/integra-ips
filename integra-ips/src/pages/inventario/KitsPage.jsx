import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdMedicalServices, MdAirportShuttle, MdHealing, MdErrorOutline, MdCheckCircle, MdWarning, MdDelete, MdSave, MdLocalShipping, MdInventory2 } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { SITE_TYPES } from '../../utils/permissions'
import { PageHead, Card, Modal, Empty, Spinner, useToast } from '../../components/ui'
import { qty, TransferModal } from './common'

// IIPS-024 · Kits biomédicos, botiquines y dotación de ambulancias.
// Cada uno es una bodega de la sede (su stock real) con una dotación estándar (lo que debe tener).
// Se cargan con un traslado y, en eventos y traslados, se sabe de qué kit o móvil salió cada insumo.
const KINDS = { kit: 'Kit biomédico', botiquin: 'Botiquín', ambulancia: 'Dotación de ambulancia' }
const ICON = { kit: <MdMedicalServices />, botiquin: <MdHealing />, ambulancia: <MdAirportShuttle /> }

const KitForm = ({ initial, sites, vehicles, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState(() => ({ kind: initial?.kind || 'kit', name: initial?.name || '', siteId: initial?.siteId || '', vehicleId: initial?.vehicleId || '', responsible: initial?.responsible || '', location: initial?.location || '', description: initial?.description || '', active: initial?.active ?? true }))
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const pickVehicle = (id) => {
    const v = vehicles.find((x) => String(x.id) === String(id))
    setF((x) => ({ ...x, vehicleId: id, siteId: v?.siteId || x.siteId, name: x.name || (v ? `Dotación Móvil ${v.movil}` : '') }))
  }
  const submit = async () => {
    setError('')
    if (!f.name.trim()) return setError('Escribe el nombre.')
    if (!f.siteId) return setError('Selecciona la sede.')
    if (f.kind === 'ambulancia' && !f.vehicleId) return setError('Selecciona la ambulancia.')
    setSaving(true)
    try {
      const body = { ...f, vehicleId: f.kind === 'ambulancia' ? Number(f.vehicleId) : null }
      const { data } = editing ? await api.put(`/inventario/bodegas/${initial.id}`, body) : await api.post('/inventario/bodegas', body)
      onSaved(data)
    } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={editing ? `Editar ${initial.name}` : 'Nuevo kit, botiquín o dotación'} onClose={onClose}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar</button></>}>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="field span-all"><label>Tipo <span className="req">*</span></label>
          <div className="module-switch inline">{Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k })} disabled={editing}>{ICON[k]} {l}</button>)}</div>
        </div>
        {f.kind === 'ambulancia' && (
          <div className="field span-all"><label>Ambulancia <span className="req">*</span></label>
            <select value={f.vehicleId} onChange={(e) => pickVehicle(e.target.value)} disabled={editing}>
              <option value="">Selecciona la móvil…</option>
              {vehicles.filter((v) => v.isAmbulance).map((v) => <option key={v.id} value={v.id}>Móvil {v.movil} · {v.plate} · {v.ambulanceType}</option>)}
            </select></div>
        )}
        <div className="field span-all"><label>Nombre <span className="req">*</span></label><input value={f.name} onChange={set('name')} placeholder={f.kind === 'botiquin' ? 'Ej. Botiquín tipo A · Socorro 1' : f.kind === 'kit' ? 'Ej. Kit de trauma 1' : 'Ej. Dotación Móvil 101'} maxLength={120} /></div>
        <div className="field"><label>Sede <span className="req">*</span></label>
          <select value={f.siteId} onChange={set('siteId')}>
            <option value="">Selecciona…</option>
            {Object.entries(SITE_TYPES).map(([t, l]) => <optgroup key={t} label={l}>{sites.filter((x) => x.type === t).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
          </select></div>
        <div className="field"><label>Responsable</label><input value={f.responsible} onChange={set('responsible')} placeholder="Nombre y cargo" /></div>
        <div className="field span-all"><label>Descripción</label><input value={f.description} onChange={set('description')} placeholder="Uso, ubicación habitual, número de serie del maletín…" /></div>
        {editing && <div className="field span-all"><label className="switch"><input type="checkbox" checked={f.active} onChange={set('active')} /> {f.active ? 'Activo' : 'Inactivo'}</label></div>}
      </div>
      {error && <div className="alert bad" style={{ marginTop: 14 }}><MdErrorOutline /><span>{error}</span></div>}
    </Modal>
  )
}

// Dotación estándar: productos del catálogo y cantidad que debe tener.
const DotationForm = ({ kit, onClose, onSaved }) => {
  const [products, setProducts] = useState(null)
  const [rows, setRows] = useState(() => kit.dotation.map((d) => ({ productId: String(d.productId), quantity: d.quantity })))
  const [q, setQ] = useState('')
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { api.get('/inventario/productos').then(({ data }) => setProducts(data.filter((p) => p.active))).catch((e) => setError(errorMessage(e))) }, [])
  const byId = useMemo(() => Object.fromEntries((products || []).map((p) => [String(p.id), p])), [products])
  const found = (products || []).filter((p) => !rows.some((r) => r.productId === String(p.id)) && q.trim().length >= 2 && `${p.code} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
  const submit = async () => {
    setError('')
    if (rows.some((r) => !(Number(r.quantity) > 0))) return setError('Cada producto necesita una cantidad mayor que cero.')
    setSaving(true)
    try { const { data } = await api.put(`/inventario/kits/${kit.id}/dotacion`, { items: rows.map((r) => ({ productId: Number(r.productId), quantity: Number(r.quantity) })) }); onSaved(data) } catch (e) { setError(errorMessage(e)); setSaving(false) }
  }
  return (
    <Modal title={`Dotación · ${kit.name}`} size="lg" onClose={onClose}
      footer={<><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" onClick={submit} disabled={saving || !products}>{saving ? <Spinner /> : <MdSave />} Guardar dotación</button></>}>
      {!products ? <Spinner /> : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="field"><label>Agregar producto del catálogo</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por código o nombre (mínimo 2 letras)" /></div>
          {found.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              {found.map((p) => <button key={p.id} type="button" className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { setRows([...rows, { productId: String(p.id), quantity: 1 }]); setQ('') }}><MdAdd /> {p.code} · {p.name} <small style={{ color: 'var(--muted)' }}>({p.unitLabel})</small></button>)}
            </div>
          )}
          {rows.length === 0 ? <Empty icon={<MdInventory2 />}>Aún no hay productos en la dotación.</Empty> : (
            <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10 }}>
              <table className="table">
                <thead><tr><th>Producto</th><th style={{ width: 130 }}>Cantidad</th><th className="actions" /></tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={r.productId}>
                    <td><strong style={{ color: 'var(--ink)' }}>{byId[r.productId]?.name || r.productId}</strong> <small style={{ color: 'var(--muted)' }}>{byId[r.productId]?.code} · {byId[r.productId]?.unitLabel}</small></td>
                    <td><input className="input" type="number" min="0" step="any" value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} style={{ height: 34 }} /></td>
                    <td className="actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" style={{ color: 'var(--bad)' }} onClick={() => setRows(rows.filter((_, j) => j !== i))}><MdDelete /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {error && <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>}
        </div>
      )}
    </Modal>
  )
}

const KitCard = ({ k, admin, onEdit, onDotation, onLoad }) => {
  const [open, setOpen] = useState(false)
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{ICON[k.kind]} {k.name}</span>}
      subtitle={`${KINDS[k.kind]} · ${k.siteName}${k.vehicle ? ` · Móvil ${k.vehicle.movil}` : ''}${k.responsible ? ` · ${k.responsible}` : ''}`}
      actions={<>
        {!k.active && <span className="badge">Inactivo</span>}
        {k.dotation.length === 0 ? <span className="badge">Sin dotación definida</span> : k.complete ? <span className="badge ok"><MdCheckCircle /> Completo</span> : <span className="badge warn"><MdWarning /> Faltan {k.missingItems}</span>}
        {k.expired > 0 && <span className="badge bad">{k.expired} vencido{k.expired === 1 ? '' : 's'}</span>}
      </>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Ocultar contenido' : `Ver contenido (${k.lines.length} lote${k.lines.length === 1 ? '' : 's'})`}</button>
        {admin && <button type="button" className="btn btn-outline btn-sm" onClick={onDotation}><MdInventory2 /> Dotación</button>}
        {admin && <button type="button" className="btn btn-outline btn-sm" onClick={onLoad}><MdLocalShipping /> Cargar / reponer</button>}
        {admin && <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><MdEdit /> Editar</button>}
      </div>
      {open && (
        <div className="table-wrap" style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
          <table className="table">
            <thead><tr><th>Producto</th><th className="num">Debe tener</th><th className="num">Tiene</th><th className="num">Falta</th></tr></thead>
            <tbody>
              {k.dotation.map((d) => (
                <tr key={d.productId}>
                  <td><strong style={{ color: 'var(--ink)' }}>{d.product?.name}</strong> <small style={{ color: 'var(--muted)' }}>{d.product?.code}</small></td>
                  <td className="num">{qty(d.quantity)}</td><td className="num">{qty(d.stock)}</td>
                  <td className="num" style={d.missing ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{d.missing ? qty(d.missing) : '—'}</td>
                </tr>
              ))}
              {k.lines.filter((l) => !k.dotation.some((d) => d.productId === l.product.id)).map((l) => (
                <tr key={`x${l.id}`}><td>{l.product.name} <small style={{ color: 'var(--muted)' }}>· fuera de la dotación{l.lot ? ` · lote ${l.lot}` : ''}</small></td><td className="num">—</td><td className="num">{qty(l.stock)}</td><td className="num">—</td></tr>
              ))}
              {k.dotation.length === 0 && k.lines.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>Vacío. Define la dotación y cárgalo con un traslado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

const KitsPage = () => {
  const { user } = useAuth()
  const admin = user.role === 'administrador'
  const [toast, toastNode] = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [sites, setSites] = useState([]); const [vehicles, setVehicles] = useState([]); const [warehouses, setWarehouses] = useState([])
  const [filter, setFilter] = useState('')
  const load = useCallback(() => api.get('/inventario/kits', { noCache: true }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => {
    load()
    if (admin) {
      api.get('/sedes', { params: { sede: undefined } }).then(({ data }) => setSites(data)).catch(() => {})
      api.get('/vehiculos', { params: { sede: undefined } }).then(({ data }) => setVehicles(data)).catch(() => {})
      api.get('/inventario/bodegas', { params: { sede: undefined, todas: 1 } }).then(({ data }) => setWarehouses(data)).catch(() => {})
    }
  }, [load, admin])
  const shown = (rows || []).filter((k) => !filter || k.kind === filter)
  const done = (msg) => { setModal(null); toast(msg); load() }
  return (
    <>
      <PageHead title="Kits, botiquines y ambulancias" subtitle="Cada uno con su dotación estándar y su stock. Al llevarlos a un evento o un traslado se sabe de dónde salió cada insumo.">
        {admin && <button type="button" className="btn btn-primary" onClick={() => setModal({ form: {} })}><MdAdd /> Nuevo</button>}
      </PageHead>
      <div className="module-switch inline" style={{ marginBottom: 16 }}>
        <button type="button" className={!filter ? 'on' : ''} onClick={() => setFilter('')}>Todos</button>
        {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{ICON[k]} {l}</button>)}
      </div>
      {error && <div className="alert bad" style={{ marginBottom: 16 }}><MdErrorOutline /><span>{error}</span></div>}
      {!rows ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div> : shown.length === 0 ? <Card><Empty icon={<MdMedicalServices />}>Aún no hay {filter ? KINDS[filter].toLowerCase() : 'kits, botiquines ni dotaciones'}.{admin ? ' Créalos con el botón Nuevo.' : ''}</Empty></Card> : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          {shown.map((k) => <KitCard key={k.id} k={k} admin={admin} onEdit={() => setModal({ form: k })} onDotation={() => setModal({ dotation: k })} onLoad={() => setModal({ load: k })} />)}
        </div>
      )}
      {modal?.form && <KitForm initial={modal.form} sites={sites} vehicles={vehicles} onClose={() => setModal(null)} onSaved={() => done(modal.form.id ? 'Cambios guardados' : 'Creado. Ahora define su dotación.')} />}
      {modal?.dotation && <DotationForm kit={modal.dotation} onClose={() => setModal(null)} onSaved={() => done('Dotación guardada')} />}
      {modal?.load && warehouses.length > 0 && <TransferModal warehouses={warehouses} defaultTo={modal.load.id} onClose={() => setModal(null)} onSaved={(m) => done(m)} />}
      {toastNode}
    </>
  )
}

export default KitsPage
