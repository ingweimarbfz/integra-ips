import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdSearch, MdPersonSearch, MdArrowBack, MdErrorOutline, MdVaccines, MdBiotech, MdAirportShuttle, MdReceiptLong, MdAdd, MdEventRepeat } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { PageHead, Card, Empty, Spinner } from '../components/ui'

// IIPS-027 · Historial por persona: todos los servicios de un paciente (citologías, vacunas, traslados y cobros).
const fmt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const SOURCES = { citologias: 'Citologías', vacunacion: 'Vacunas', traslados: 'Traslados' }

export const PatientsSearch = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (q.trim().length < 3) { setRows(null); return undefined }
    const t = setTimeout(() => api.get('/pacientes/buscar', { params: { q: q.trim() } }).then(({ data }) => setRows(data)).catch((e) => setError(errorMessage(e))), 300)
    return () => clearTimeout(t)
  }, [q])
  return (
    <>
      <PageHead title="Historial por persona" subtitle="Busca a la persona por documento o nombre y consulta o registra todos sus servicios." />
      <Card>
        <div className="field"><label>Documento o nombre</label>
          <div style={{ position: 'relative' }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. 1065123456 o María Pérez" autoFocus style={{ paddingLeft: 36 }} /><MdSearch style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} /></div>
        </div>
        {/^\d{5,}$/.test(q.trim()) && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => navigate(`/pacientes/${q.trim()}`)}><MdPersonSearch /> Abrir la ficha del documento {q.trim()}</button>}
      </Card>
      {error && <div className="alert bad" style={{ marginTop: 12 }}><MdErrorOutline /><span>{error}</span></div>}
      {rows && (
        <div style={{ marginTop: 16 }}><Card flush>
          {rows.length === 0 ? <Empty icon={<MdPersonSearch />}>Sin resultados. Si es una persona nueva, abre la ficha con su documento y registra el servicio.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Persona</th><th>Documento</th><th>Servicios</th><th>Último</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.document} className="th-row" onClick={() => navigate(`/pacientes/${r.document}`)}>
                  <td><strong style={{ color: 'var(--ink)' }}>{r.fullName || '—'}</strong></td><td>{r.documentType || ''} {r.document}</td>
                  <td>{Object.entries(r.services).map(([k, n]) => <span key={k} className="badge" style={{ marginRight: 4 }}>{SOURCES[k]} · {n}</span>)}</td><td>{fmt(r.lastDate)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card></div>
      )}
    </>
  )
}

export const PatientDetail = () => {
  const { doc } = useParams()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get(`/pacientes/${doc}`, { noCache: true }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e))) }, [doc])
  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!d) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const p = d.person
  return (
    <>
      <div style={{ marginBottom: 12 }}><Link to="/pacientes" className="btn btn-ghost btn-sm"><MdArrowBack /> Buscar otra persona</Link></div>
      <PageHead title={p?.fullName || `Documento ${doc}`} subtitle={p ? [`${p.documentType || ''} ${doc}`, p.birthDate && `Nació el ${fmt(p.birthDate)}`, p.phone, p.eps, p.municipality].filter(Boolean).join(' · ') : 'Sin servicios registrados. Puedes registrar el primero.'}>
        {d.modules.citologias && <Link className="btn btn-outline" to={`/citologias/registrar?documento=${doc}`}><MdAdd /> Citología</Link>}
        {d.modules.vacunacion && <Link className="btn btn-primary" to={`/vacunacion/registrar?documento=${doc}`}><MdAdd /> Vacuna</Link>}
      </PageHead>
      {d.nextDose && <div className="alert info" style={{ marginBottom: 16 }}><MdEventRepeat /><span>Próxima dosis: <b>{d.nextDose.vaccine} · {d.nextDose.label}</b> el {fmt(d.nextDose.date)}.</span></div>}
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {d.modules.citologias && (
          <Card flush title={`Citologías (${d.totals.cytologies})`} icon={<MdBiotech style={{ color: 'var(--brand)' }} />}>
            {d.cytologies.length === 0 ? <Empty icon={<MdBiotech />}>Sin citologías.</Empty> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Lámina</th><th>EPS</th><th>Sede</th></tr></thead>
                <tbody>{d.cytologies.map((c) => <tr key={c.id}><td><Link to={`/citologias/${c.id}`}>{fmt(c.date)}</Link></td><td>{c.lamina || '—'}</td><td>{c.eps || '—'}</td><td>{c.siteName || '—'}</td></tr>)}</tbody></table></div>
            )}
          </Card>
        )}
        {d.modules.vacunacion && (
          <Card flush title={`Vacunas (${d.totals.vaccinations})`} icon={<MdVaccines style={{ color: 'var(--brand)' }} />} actions={d.totals.vaccinations ? <Link className="btn btn-ghost btn-sm" to={`/vacunacion/carne/${doc}`}>Carnet</Link> : null}>
            {d.vaccinations.length === 0 ? <Empty icon={<MdVaccines />}>Sin vacunas.</Empty> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Biológico</th><th>Dosis</th><th>Lote</th></tr></thead>
                <tbody>{d.vaccinations.map((v) => <tr key={v.id}><td>{fmt(v.date)}</td><td>{v.vaccine}</td><td>{v.dose}</td><td>{v.lot || '—'}</td></tr>)}</tbody></table></div>
            )}
          </Card>
        )}
        {d.modules.traslados && (
          <Card flush title={`Traslados asistenciales (${d.totals.transfers})`} icon={<MdAirportShuttle style={{ color: 'var(--brand)' }} />}>
            {d.transfers.length === 0 ? <Empty icon={<MdAirportShuttle />}>Sin traslados.</Empty> : (
              <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Origen → destino</th><th>Móvil</th></tr></thead>
                <tbody>{d.transfers.map((t) => <tr key={t.id}><td>{t.trip ? <Link to={`/socorro/vehiculos/reportes/${t.trip.id}`}>{fmt(t.date)}</Link> : fmt(t.date)}</td><td>{t.origin} → {t.destination}</td><td>{t.trip?.movil || '—'}</td></tr>)}</tbody></table></div>
            )}
          </Card>
        )}
        {d.modules.facturacion && d.charges.length > 0 && (
          <Card flush title={`Cobros (${d.totals.charges})`} icon={<MdReceiptLong style={{ color: 'var(--brand)' }} />}>
            <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Servicio</th><th>Factura</th><th className="num">Valor</th></tr></thead>
              <tbody>{d.charges.map((c) => <tr key={c.id}><td>{fmt(c.date)}</td><td>{c.service}</td><td>{c.invoice || 'Por facturar'}</td><td className="num">{money(c.value)}</td></tr>)}</tbody></table></div>
          </Card>
        )}
      </div>
    </>
  )
}
