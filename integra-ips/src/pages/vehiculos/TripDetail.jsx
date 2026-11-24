import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdArrowBack, MdFlag, MdDelete, MdErrorOutline, MdPrint } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import useDirections from '../../hooks/useDirections'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { Modal, Spinner, useToast } from '../../components/ui'
import { CloseTripModal } from './TripsPage'
import { km, money } from './common'
import { fmtDate, fmtTime, duration } from '../socorro/common'
import '../../components/cytology.css'
import { SignBlock, useDocSignatures } from '../../components/signature'
import { DOC_TYPES, REGIMES, PRIORITIES, TRANSFER_TYPES, CONDITIONS, SEX } from './transfer'


// IIPS-024 · Insumos gastados de la dotación de la ambulancia (se descuentan del stock de esa móvil).
const TripSupplies = ({ t, onChange, toast }) => {
  const [stock, setStock] = useState(null)
  const [f, setF] = useState({ itemId: '', quantity: '', observation: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => { api.get(`/vehiculos-reportes/${t.id}/dotacion`, { noCache: true }).then(({ data }) => setStock(data)).catch(() => setStock({ warehouse: null, lines: [], canEdit: false })) }, [t.id, t.supplies.length])
  const add = async () => {
    if (!f.itemId || !(Number(f.quantity) > 0)) return toast('Elige el insumo y la cantidad', 'bad')
    setSaving(true)
    try { const { data } = await api.post(`/vehiculos-reportes/${t.id}/insumos`, { ...f, itemId: Number(f.itemId), quantity: Number(f.quantity) }); onChange(data); setF({ itemId: '', quantity: '', observation: '' }); toast('Insumo registrado y descontado de la dotación') } catch (e) { toast(errorMessage(e), 'bad') } finally { setSaving(false) }
  }
  const remove = async (sid) => { try { const { data } = await api.delete(`/vehiculos-reportes/${t.id}/insumos/${sid}`); onChange(data); toast('Consumo anulado') } catch (e) { toast(errorMessage(e), 'bad') } }
  if (!stock) return null
  if (!stock.warehouse && !t.supplies.length) return null
  return (
    <section className="cy-section ev-table-section">
      <h3 className="cy-section-title">Insumos usados{stock.warehouse ? ` · ${stock.warehouse.name}` : ''}</h3>
      {t.supplies.length ? (
        <table className="ev-table"><thead><tr><th>Insumo</th><th>Lote</th><th>Cantidad</th><th>Observación</th>{stock.canEdit && <th className="no-print" />}</tr></thead>
          <tbody>{t.supplies.map((x) => <tr key={x.id}><td>{x.item?.name}</td><td>{x.item?.lot || '—'}</td><td>{x.quantity} {x.item?.unit}</td><td>{x.observation || '—'}</td>{stock.canEdit && <td className="no-print"><button type="button" className="btn btn-ghost btn-icon" aria-label="Anular" style={{ color: 'var(--bad)' }} onClick={() => remove(x.id)}><MdDelete /></button></td>}</tr>)}</tbody>
        </table>
      ) : <p style={{ margin: 0, color: 'var(--muted)' }}>Sin insumos registrados.</p>}
      {stock.canEdit && stock.warehouse && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 90px minmax(0, 1.4fr) auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
          <div className="field"><label>Insumo</label><select value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}><option value="">Selecciona…</option>{stock.lines.filter((l) => !l.expired).map((l) => <option key={l.id} value={l.id}>{l.name}{l.lot ? ` · lote ${l.lot}` : ''} · hay {l.stock}</option>)}</select></div>
          <div className="field"><label>Cantidad</label><input type="number" min="0" step="any" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div className="field"><label>Observación</label><input value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} placeholder="Opcional" /></div>
          <button type="button" className="btn btn-primary" onClick={add} disabled={saving}>{saving ? <Spinner /> : 'Registrar'}</button>
        </div>
      )}
    </section>
  )
}

// Reporte diario del conductor: vista e impresión (PDF).
const TripDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const dirs = useDirections()
  const { logo, settings } = useSettings()
  const [toast, toastNode] = useToast()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const doc = useDocSignatures('reporte_vehiculo', t?.id)

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/vehiculos-reportes/${id}`); setT(data) } catch (e) { setError(errorMessage(e)) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!t) return undefined
    const p = document.title; document.title = `Reporte_${t.code}_Movil_${t.vehicle.movil}`
    return () => { document.title = p }
  }, [t])

  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!t) return <div className="splash"><Spinner /> Cargando reporte…</div>

  const open = t.status === 'abierto'
  const canDelete = open || user.role === 'administrador'
  const printedAt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date())

  return (
    <div className="cy-detail-page">
      <div className="cy-toolbar no-print" style={{ flexWrap: 'wrap' }}>
        <Link to="/socorro/vehiculos/reportes" className="btn btn-outline"><MdArrowBack /> Reportes</Link>
        <div style={{ display: 'flex', gap: 8 }}>
          {canDelete && <button type="button" className="btn btn-ghost" style={{ color: 'var(--bad)' }} onClick={() => setModal('delete')}><MdDelete /> Eliminar</button>}
          {open && <button type="button" className="btn btn-primary" onClick={() => setModal('close')} disabled={!t.canClose}><MdFlag /> Cerrar actividad</button>}
          <button type="button" className={`btn ${open ? 'btn-outline' : 'btn-primary'}`} onClick={() => window.print()}><MdPrint /> Imprimir / Guardar PDF</button>
        </div>
      </div>

      {open && !t.canClose && (
        <div className="alert info no-print" style={{ maxWidth: '216mm', margin: '0 auto 12px' }}>
          <MdFlag /><span>Esta actividad está asociada al servicio <b>{t.event.code} · {t.event.name}</b>, que sigue en curso. Se podrá cerrar cuando el coordinador finalice el servicio.</span>
        </div>
      )}
      <article className="cy-sheet ev-sheet">
        <header className="cy-sheet-header">
          <img src={logo} alt={settings.ipsName} className="cy-logo" />
          <div className="cy-sheet-heading">
            <p className="cy-kicker">{t.transfer ? 'IPS · Traslado asistencial' : 'Operaciones Generales · Flota vehicular institucional'}</p>
            <h2>{t.transfer ? 'Reporte de traslado asistencial' : 'Reporte diario de actividad vehicular'}</h2>
          </div>
          <dl className="cy-meta">
            <div><dt>Reporte</dt><dd>{t.code}</dd></div>
            <div><dt>Fecha</dt><dd>{fmtDate(t.startedAt)}</dd></div>
            <div><dt>Estado</dt><dd>{open ? 'Abierto' : 'Cerrado'}</dd></div>
          </dl>
        </header>

        <div className="cy-patient-band ev-band">
          <div><span className="cy-field-label">Actividad / servicio</span><strong className="cy-patient-name">{t.activity}</strong>{t.event && <span className="ev-sub">Servicio {t.event.code}</span>}</div>
          <div><span className="cy-field-label">Vehículo</span><strong>Móvil {t.vehicle.movil} · {t.vehicle.plate}</strong><span className="ev-sub">{t.vehicle.vehicleType} {t.vehicle.brand} {t.vehicle.line}</span></div>
          <div><span className="cy-field-label">Conductor</span><strong>{t.driver.name}</strong><span className="ev-sub">CC {t.driver.identification}</span></div>
        </div>

        {t.transfer && (() => {
          const x = t.transfer
          const F = ({ l, v, wide }) => <div className={`cy-field${wide ? ' cy-field-wide' : ''}`}><span className="cy-field-label">{l}</span><span className="cy-field-value">{v || '—'}</span></div>
          return (
            <section className="cy-section">
              <h3 className="cy-section-title">Traslado asistencial · ambulancia {/TAM/i.test(t.vehicle.vehicleType) ? 'TAM' : 'TAB'}</h3>
              <div className="cy-grid">
                <F l="Paciente" v={x.patientName} wide />
                <F l="Identificación" v={`${x.documentType} ${x.document}`} />
                <F l="Tipo de documento" v={DOC_TYPES[x.documentType]} />
                <F l="Sexo · edad" v={[SEX[x.sex], x.ageYears != null && `${x.ageYears} años`].filter(Boolean).join(' · ')} />
                <F l="Teléfono" v={x.phone} />
                <F l="EPS / aseguradora" v={x.eps} />
                <F l="Régimen" v={REGIMES[x.regime]} />
                <F l="Tipo de traslado" v={TRANSFER_TYPES[x.transferType]} />
                <F l="Prioridad" v={PRIORITIES[x.priority]?.[0]} />
                <F l="Condición del paciente" v={CONDITIONS[x.patientCondition]} />
                <F l="Origen" v={x.origin} wide />
                <F l="Destino (IPS receptora)" v={x.destination} wide />
                <F l="Diagnóstico / motivo" v={x.diagnosis} wide />
                <F l="Autorización / remisión" v={x.authorizationNumber} />
                <F l="Profesional que recibe" v={x.receivingProfessional} />
                <F l="Acompañante" v={[x.companionName, x.companionPhone].filter(Boolean).join(' · ')} />
                {x.notes && <F l="Observaciones" v={x.notes} wide />}
              </div>
            </section>
          )
        })()}

        <section className="cy-section">
          <h3 className="cy-section-title">Kilometraje</h3>
          <div className="tr-km">
            <div><span>Km de salida</span><strong>{km(t.kmOut)}</strong></div>
            <div><span>Km de llegada</span><strong>{t.kmIn == null ? '—' : km(t.kmIn)}</strong></div>
            <div className="hl"><span>Diferencia (recorrido)</span><strong>{t.kmDiff == null ? '—' : km(t.kmDiff)}</strong></div>
          </div>
          <div className="cy-grid" style={{ marginTop: '4mm' }}>
            <div className="cy-field"><span className="cy-field-label">Hora de salida</span><span className="cy-field-value">{fmtTime(t.startedAt)}</span></div>
            <div className="cy-field"><span className="cy-field-label">Hora de llegada</span><span className="cy-field-value">{t.endedAt ? fmtTime(t.endedAt) : 'En curso'}</span></div>
            <div className="cy-field"><span className="cy-field-label">Duración</span><span className="cy-field-value">{duration(t.startedAt, t.endedAt)}</span></div>
            <div className="cy-field"><span className="cy-field-label">Combustible</span><span className="cy-field-value">{t.fuelValue ? `${money(t.fuelValue)}${t.fuelGallons ? ` · ${t.fuelGallons} gal` : ''}` : 'Sin tanqueo'}</span></div>
          </div>
        </section>

        <section className="cy-section cy-notes" style={{ gridTemplateColumns: '1fr' }}>
          <div><h3 className="cy-section-title">Observación</h3><p>{t.observation || '—'}</p></div>
        </section>

        {(t.tachometerPhoto || t.fuelTicketPhoto) && (
          <section className="cy-section">
            <h3 className="cy-section-title">Evidencias</h3>
            <div className="tr-evidence">
              {t.tachometerPhoto && <figure><figcaption>Tacómetro al llegar</figcaption><img src={t.tachometerPhoto} alt="Tacómetro" /></figure>}
              {t.fuelTicketPhoto && <figure><figcaption>Ticket de combustible</figcaption><img src={t.fuelTicketPhoto} alt="Ticket de combustible" /></figure>}
            </div>
          </section>
        )}

        <TripSupplies t={t} onChange={setT} toast={toast} />

        <section className="cy-signatures" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <SignBlock doc={doc} slot="conductor" label="Conductor" name={t.driver.name} canSign={t.driver.id === user.id} />
          <SignBlock doc={doc} slot="reviso" label="Revisó · Dirección de Socorro y Operaciones" canSign={user.role === 'administrador' || dirs.directs('socorro_operaciones')} />
        </section>

        <footer className="cy-sheet-footer">
          <span>{settings.ipsName} · Flota vehicular</span>
          <span>Impreso el {printedAt}</span>
        </footer>
      </article>

      {modal === 'close' && <CloseTripModal trip={t} onClose={() => setModal(null)} onClosed={(d) => { setT(d); setModal(null); toast('Actividad cerrada. Km actualizado en la móvil.') }} />}
      {modal === 'delete' && (
        <Modal title="Eliminar reporte" size="sm" onClose={() => setModal(null)}
          footer={<><button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={async () => { try { await api.delete(`/vehiculos-reportes/${t.id}`); navigate('/socorro/vehiculos/reportes') } catch (e) { toast(errorMessage(e), 'bad'); setModal(null) } }}><MdDelete /> Eliminar</button></>}>
          <p style={{ margin: 0 }}>¿Eliminar el reporte <b>{t.code}</b>?{!open && ' Si es el último cerrado de la móvil, su kilometraje vuelve al km de salida.'}</p>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}

export default TripDetail
