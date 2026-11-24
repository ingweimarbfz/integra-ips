import React, { useEffect, useState } from 'react'
import { MdVerifiedUser, MdErrorOutline } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { Card, Spinner, useToast } from '../components/ui'

// IIPS-023 · Directores de área: quién revisa y firma los reportes de cada área en lugar del administrador.
// En IPS se puede nombrar un director general y, si se quiere, uno por cada servicio ofertado.
const HINTS = {
  socorro_operaciones: 'Firma el "Revisó" de eventos de socorro, reportes diarios y preoperacionales de la flota, e inventario.',
  talento_humano: 'Firma el "Revisó" de las listas de chequeo y las hojas de vida del personal.',
  ips: 'Firma la coordinación de las hojas de vida de equipos, el reporte de temperatura y las verificaciones de estándares.',
  educacion: 'Firma las actas de asistencia y el "Revisó" de las actividades de educación.'
}

const DirectorsCard = () => {
  const [toast, toastNode] = useToast()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  const load = () => api.get('/directores', { noCache: true }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e)))
  useEffect(() => { load() }, [])
  const current = (area, serviceId = null) => d?.assignments.find((a) => a.area === area && (a.serviceId || null) === serviceId)?.userId || ''
  const save = async (area, serviceId, userId) => {
    const k = `${area}:${serviceId || ''}`
    setSaving(k); setError('')
    try { await api.put('/directores', { area, serviceId, userId: Number(userId) || null }); await load(); toast(userId ? 'Director asignado' : 'Director retirado') } catch (e) { setError(errorMessage(e)) } finally { setSaving('') }
  }
  const Select = ({ area, serviceId = null, label }) => (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={current(area, serviceId)} onChange={(e) => save(area, serviceId, e.target.value)} disabled={saving !== ''}>
          <option value="">{serviceId ? 'El director general de IPS' : 'Sin director (firma el administrador)'}</option>
          {d.users.map((u) => <option key={u.id} value={u.id}>{u.fullName}{u.role === 'administrador' ? ' (administrador)' : ''}</option>)}
        </select>
        {saving === `${area}:${serviceId || ''}` && <Spinner />}
      </div>
    </div>
  )
  return (
    <Card title="Directores de área" subtitle="Cada director revisa y firma los reportes de su área. Los documentos le llegan a su bandeja en Mi firma digital y a la campana." icon={<MdVerifiedUser style={{ color: 'var(--brand)' }} />}>
      {!d ? (error ? null : <Spinner />) : (
        <div className="stack" style={{ gap: 16 }}>
          {d.areas.map((a) => (
            <div key={a.key}>
              <Select area={a.key} label={a.label} />
              <span className="hint">{HINTS[a.key]}</span>
              {a.key === 'ips' && d.services.length > 0 && (
                <div className="grid grid-2" style={{ gap: 12, marginTop: 10, paddingLeft: 12, borderLeft: '3px solid var(--line-2)' }}>
                  {d.services.map((s) => <Select key={s.id} area="ips" serviceId={s.id} label={`Director de IPS · ${s.name}`} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <div className="alert bad" style={{ marginTop: 12 }}><MdErrorOutline /><span>{error}</span></div>}
      {toastNode}
    </Card>
  )
}

export default DirectorsCard
