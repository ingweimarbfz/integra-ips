import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { MdAdd, MdEdit, MdMedicalServices, MdAirportShuttle, MdHealing, MdErrorOutline, MdCheckCircle, MdWarning, MdDelete, MdSave, MdLocalShipping, MdInventory2 } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { SITE_TYPES } from '../../utils/permissions'
import { PageHead, Card, Modal, Empty, Spinner, useToast } from '../../components/ui'
import { qty } from './common'

// IIPS-024 · Kits biomédicos, botiquines y dotación de ambulancias.
// Cada uno es una bodega de la sede (su stock real) con una dotación estándar (lo que debe tener).
// Se cargan con un traslado y, en eventos y traslados, se sabe de qué kit o móvil salió cada insumo.
const KINDS = { kit: 'Kit biomédico', botiquin: 'Botiquín', ambulancia: 'Dotación de ambulancia' }
const ICON = { kit: <MdMedicalServices />, botiquin: <MdHealing />, ambulancia: <MdAirportShuttle /> }

const KitForm = ({ initial, sites, vehicles, users, onClose, onSaved }) => {
  const editing = Boolean(initial?.id)
  const [f, setF] = useState(() => ({ kind: initial?.kind || 'kit', name: initial?.name || '', siteId: initial?.siteId || '', vehicleId: initial?.vehicleId || '', responsible: initial?.responsible || '', responsibleUserId: initial?.responsibleUserId || '', location: initial?.location || '', description: initial?.description || '', active: initial?.active ?? true }))
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
        <div className="field"><label>Responsable</label>
          <select value={f.responsibleUserId} onChange={set('responsibleUserId')}>
            <option value="">{f.responsible && !f.responsibleUserId ? f.responsible : 'Sin responsable'}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select></div>
        <div className="field span-all"><label>Descripción</label><input value={f.description} onChange={set('description')} placeholder="Uso, ubicación habitual, número de serie del maletín…" /></div>
        {editing && <div className="field span-all"><label className="switch"><input type="checkbox" checked={f.active} onChange={set('active')} /> {f.active ? 'Activo' : 'Inactivo'}</label></div>}
      </div>
      {error && <div className="alert bad" style={{ marginTop: 14 }}><MdErrorOutline /><span>{error}</span></div>}
    </Modal>
  )
}

// IIPS-036 · Un solo lugar para cada kit: lo que DEBE tener (dotación, por compartimiento) frente a lo que TIENE
// (su stock). Desde aquí se agrega a la dotación lo que está fuera de ella, se reponen los faltantes desde una
// bodega y se desarma el kit devolviendo su contenido (sin perder inventario).
const KitManager = ({ kit: initial, admin, warehouses, onClose, onChanged, toast }) => {
  const [kit, setKit] = useState(initial)
  const [rows, setRows] = useState(() => initial.dotation.map((d) => ({ productId: String(d.productId), quantity: d.quantity, compartment: d.compartment })))
  const [comps, setComps] = useState(initial.compartments)
  const [newComp, setNewComp] = useState('')
  const [products, setProducts] = useState(null)
  const [q, setQ] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [from, setFrom] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [toWh, setToWh] = useState('')
  useEffect(() => { if (admin) api.get('/inventario/productos').then(({ data }) => setProducts(data.filter((p) => p.active))).catch(() => {}) }, [admin])
  const sources = warehouses.filter((w) => w.active && (w.kind || 'bodega') === 'bodega' && (w.isGeneral || w.siteId === kit.siteId))
  useEffect(() => { if (!from && sources.length) setFrom(String((sources.find((w) => w.siteId === kit.siteId && !w.isGeneral) || sources[0]).id)) }, [sources.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => Object.fromEntries([...(products || []), ...kit.dotation.map((d) => d.product), ...kit.outside.map((o) => o.product)].filter(Boolean).map((p) => [String(p.id), p])), [products, kit])
  const stockOf = (pid) => (kit.dotation.find((d) => String(d.productId) === pid)?.stock ?? kit.outside.find((o) => String(o.productId) === pid)?.stock ?? 0)
  const change = (fn) => { setRows(fn); setDirty(true) }
  const addRow = (pid, quantity = 1, compartment = comps[0]) => change((rs) => (rs.some((r) => r.productId === String(pid)) ? rs : [...rs, { productId: String(pid), quantity, compartment }]))
  const found = (products || []).filter((p) => !rows.some((r) => r.productId === String(p.id)) && q.trim().length >= 2 && `${p.code} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
  const outside = kit.outside.filter((o) => !rows.some((r) => r.productId === String(o.productId)))
  const save = async () => {
    if (rows.some((r) => !(Number(r.quantity) > 0))) return toast('Cada producto necesita una cantidad mayor que cero', 'bad')
    setBusy('save')
    try { const { data } = await api.put(`/inventario/kits/${kit.id}/dotacion`, { compartments: comps, items: rows.map((r) => ({ ...r, productId: Number(r.productId), quantity: Number(r.quantity) })) }); setKit(data); setDirty(false); toast('Dotación guardada'); onChanged() } catch (e) { toast(errorMessage(e), 'bad') } finally { setBusy('') }
  }
  const replenish = async () => {
    if (dirty) return toast('Guarda primero la dotación', 'bad')
    setBusy('rep')
    try {
      const { data } = await api.post(`/inventario/kits/${kit.id}/reponer`, { fromWarehouseId: Number(from) })
      setKit(data.kit); onChanged()
      toast(data.moved.length ? `Repuesto: ${data.moved.map((m) => `${m.quantity} ${m.name}`).join(', ')}${data.short.length ? `. Faltó en la bodega: ${data.short.map((m) => `${m.quantity} ${m.name}`).join(', ')}` : ''}` : data.short.length ? `La bodega no tiene: ${data.short.map((m) => m.name).join(', ')}` : 'No hay faltantes', data.short.length ? 'bad' : 'ok')
    } catch (e) { toast(errorMessage(e), 'bad') } finally { setBusy('') }
  }
  const dismantle = async () => {
    setBusy('des')
    try { const { data } = await api.post(`/inventario/kits/${kit.id}/desarmar`, { toWarehouseId: Number(toWh) }); toast(`${data.deleted ? 'Eliminado' : 'Desactivado'}: ${data.returned} lote(s) devueltos a la bodega`); onChanged(); onClose() } catch (e) { toast(errorMessage(e), 'bad'); setBusy('') }
  }
  const grouped = comps.map((c) => ({ c, items: rows.filter((r) => (r.compartment || comps[0]) === c) })).concat([{ c: null, items: rows.filter((r) => r.compartment && !comps.includes(r.compartment)) }]).filter((g) => g.c || g.items.length)
  return (
    <Modal title={`${KINDS[kit.kind]} · ${kit.name}`} size="lg" onClose={onClose}
      footer={<>
        {admin && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)', marginRight: 'auto' }} onClick={() => setConfirm(true)}><MdDelete /> Desarmar / eliminar</button>}
        <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        {admin && <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy === 'save'}>{busy === 'save' ? <Spinner /> : <MdSave />} Guardar dotación</button>}
      </>}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="alert info" style={{ margin: 0 }}><MdInventory2 /><span><b>Debe tener</b> es la dotación estándar que defines aquí. <b>Tiene</b> es su inventario real: entra con «Reponer faltantes» (o con un traslado) y sale cuando se gasta en un evento o traslado.</span></div>
        {admin && (
          <div className="kit-tools">
            <div className="field" style={{ flex: '2 1 260px' }}><label>Agregar producto a la dotación</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por código o nombre" />
              {found.length > 0 && <div className="picker-list">{found.map((p) => <button key={p.id} type="button" onClick={() => { addRow(p.id); setQ('') }}><b>{p.name}</b> <small>{p.code} · {p.unitLabel}</small></button>)}</div>}</div>
            <div className="field" style={{ flex: '1 1 220px' }}><label>Nuevo compartimiento</label>
              <div style={{ display: 'flex', gap: 6 }}><input value={newComp} onChange={(e) => setNewComp(e.target.value)} placeholder="Ej. Gaveta superior" /><button type="button" className="btn btn-outline" onClick={() => { if (newComp.trim() && !comps.includes(newComp.trim())) { setComps([...comps, newComp.trim()]); setDirty(true) } setNewComp('') }}><MdAdd /></button></div></div>
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.c || 'otros'} className="kit-comp">
            <div className="kit-comp-head"><b>{g.c || 'Sin compartimiento'}</b><span>{g.items.length} producto(s)</span>
              {admin && g.c && !g.items.length && comps.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setComps(comps.filter((c) => c !== g.c)); setDirty(true) }}>Quitar</button>}</div>
            {g.items.length > 0 && (
              <table className="table"><thead><tr><th>Producto</th>{admin && <th style={{ width: 170 }}>Compartimiento</th>}<th className="num" style={{ width: 110 }}>Debe tener</th><th className="num">Tiene</th><th className="num">Falta</th>{admin && <th className="actions" />}</tr></thead>
                <tbody>{g.items.map((r) => { const stock = stockOf(r.productId); const miss = Math.max(0, Number(r.quantity || 0) - stock); return (
                  <tr key={r.productId}>
                    <td><strong style={{ color: 'var(--ink)' }}>{byId[r.productId]?.name || r.productId}</strong> <small style={{ color: 'var(--muted)' }}>{byId[r.productId]?.code}</small></td>
                    {admin && <td><select value={r.compartment || comps[0]} onChange={(e) => change((rs) => rs.map((x) => (x.productId === r.productId ? { ...x, compartment: e.target.value } : x)))} style={{ width: '100%' }}>{comps.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>}
                    <td className="num">{admin ? <input type="number" min="0" step="any" value={r.quantity} onChange={(e) => change((rs) => rs.map((x) => (x.productId === r.productId ? { ...x, quantity: e.target.value } : x)))} style={{ width: 80, textAlign: 'right' }} /> : qty(r.quantity)}</td>
                    <td className="num">{qty(stock)}</td>
                    <td className="num" style={miss ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{miss ? qty(miss) : '—'}</td>
                    {admin && <td className="actions"><button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar de la dotación" style={{ color: 'var(--bad)' }} onClick={() => change((rs) => rs.filter((x) => x.productId !== r.productId))}><MdDelete /></button></td>}
                  </tr>
                ) })}</tbody></table>
            )}
          </div>
        ))}
        {outside.length > 0 && (
          <div className="kit-comp">
            <div className="kit-comp-head"><b>Tiene, pero no está en la dotación</b><span>{admin ? 'Agrégalo para controlarlo y reponerlo' : ''}</span></div>
            <table className="table"><tbody>{outside.map((o) => (
              <tr key={o.productId}><td>{o.product.name}{o.lots.length ? <small style={{ color: 'var(--muted)' }}> · lote {o.lots.join(', ')}</small> : null}</td><td className="num">Tiene {qty(o.stock)}</td>
                {admin && <td className="actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => addRow(o.productId, o.stock)}><MdAdd /> Agregar a la dotación</button></td>}</tr>
            ))}</tbody></table>
          </div>
        )}
        {admin && (
          <div className="kit-tools" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 260px' }}><label>Reponer faltantes desde</label><select value={from} onChange={(e) => setFrom(e.target.value)}>{sources.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isGeneral ? ' (general)' : ''}</option>)}</select></div>
            <button type="button" className="btn btn-primary" onClick={replenish} disabled={busy === 'rep' || !kit.missingItems || !from}>{busy === 'rep' ? <Spinner /> : <MdLocalShipping />} Reponer faltantes ({kit.missingItems})</button>
          </div>
        )}
      </div>
      {confirm && (
        <Modal title={`Desarmar ${kit.name}`} size="sm" onClose={() => setConfirm(false)} footer={<><button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>Cancelar</button><button type="button" className="btn btn-danger" onClick={dismantle} disabled={!toWh || busy === 'des'}>{busy === 'des' ? <Spinner /> : <MdDelete />} Desarmar</button></>}>
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ margin: 0 }}>Todo su contenido ({kit.lines.length} lote(s)) vuelve a la bodega que elijas, así que el inventario no se pierde. Si nunca tuvo movimientos se elimina; si los tuvo, queda inactivo para conservar el historial.</p>
            <div className="field"><label>Bodega que recibe</label><select value={toWh} onChange={(e) => setToWh(e.target.value)}><option value="">Selecciona…</option>{sources.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isGeneral ? ' (general)' : ''}</option>)}</select></div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

const KitCard = ({ k, admin, onEdit, onManage }) => (
  <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{ICON[k.kind]} {k.name}</span>}
    subtitle={`${KINDS[k.kind]}${k.ambulanceType ? ` ${k.ambulanceType}` : ''} · ${k.siteName}${k.vehicle ? ` · Móvil ${k.vehicle.movil}` : ''}${k.responsible ? ` · ${k.responsible}` : ''}`}
    actions={<>
      {k.dotation.length === 0 ? <span className="badge">Sin dotación definida</span> : k.complete ? <span className="badge ok"><MdCheckCircle /> Completo</span> : <span className="badge warn"><MdWarning /> Faltan {k.missingItems}</span>}
      {k.expired > 0 && <span className="badge bad">{k.expired} vencido{k.expired === 1 ? '' : 's'}</span>}
    </>}>
    <div className="kit-summary">
      <span><b>{k.dotation.length}</b> en la dotación</span><span><b>{k.compartments.length}</b> compartimientos</span>{k.outside.length > 0 && <span className="warn-text"><b>{k.outside.length}</b> fuera de la dotación</span>}
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={onManage}><MdInventory2 /> {admin ? 'Dotación y contenido' : 'Ver contenido'}</button>
      {admin && <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}><MdEdit /> Datos</button>}
    </div>
  </Card>
)

const KitsPage = () => {
  const { user } = useAuth()
  const admin = user.role === 'administrador'
  const [toast, toastNode] = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [sites, setSites] = useState([]); const [vehicles, setVehicles] = useState([]); const [warehouses, setWarehouses] = useState([]); const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')
  const load = useCallback(() => api.get('/inventario/kits', { noCache: true }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => {
    load()
    if (admin) {
      api.get('/sedes', { params: { sede: undefined } }).then(({ data }) => setSites(data)).catch(() => {})
      api.get('/vehiculos', { params: { sede: undefined } }).then(({ data }) => setVehicles(data)).catch(() => {})
      api.get('/inventario/bodegas', { params: { sede: undefined, todas: 1 } }).then(({ data }) => setWarehouses(data)).catch(() => {})
      api.get('/firmas/usuarios').then(({ data }) => setUsers(data.filter((u) => u.active && u.role !== 'estudiante'))).catch(() => {})
    }
  }, [load, admin])
  const shown = (rows || []).filter((k) => !filter || k.kind === filter)
  return (
    <>
      <PageHead title="Kits, botiquines y ambulancias" subtitle="Cada uno guarda su propio inventario y tiene una dotación estándar por compartimientos. Al gastar en un evento o traslado se sabe de dónde salió cada insumo.">
        {admin && <button type="button" className="btn btn-primary" onClick={() => setModal({ form: {} })}><MdAdd /> Nuevo</button>}
      </PageHead>
      <div className="module-switch inline" style={{ marginBottom: 16 }}>
        <button type="button" className={!filter ? 'on' : ''} onClick={() => setFilter('')}>Todos</button>
        {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{ICON[k]} {l}</button>)}
      </div>
      {error && <div className="alert bad" style={{ marginBottom: 16 }}><MdErrorOutline /><span>{error}</span></div>}
      {!rows ? <div className="splash" style={{ minHeight: 200 }}><Spinner /></div> : shown.length === 0 ? <Card><Empty icon={<MdMedicalServices />}>Aún no hay {filter ? KINDS[filter].toLowerCase() : 'kits, botiquines ni dotaciones'}.{admin ? ' Créalos con el botón Nuevo.' : ''}</Empty></Card> : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          {shown.map((k) => <KitCard key={k.id} k={k} admin={admin} onEdit={() => setModal({ form: k })} onManage={() => setModal({ manage: k })} />)}
        </div>
      )}
      {modal?.form && <KitForm initial={modal.form} sites={sites} vehicles={vehicles} users={users} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast(modal.form.id ? 'Cambios guardados' : 'Creado. Ahora abre «Dotación y contenido» para definir lo que debe tener.'); load() }} />}
      {modal?.manage && <KitManager key={modal.manage.id} kit={(rows || []).find((k) => k.id === modal.manage.id) || modal.manage} admin={admin} warehouses={warehouses} toast={toast} onClose={() => setModal(null)} onChanged={load} />}
      {toastNode}
    </>
  )
}

export default KitsPage
