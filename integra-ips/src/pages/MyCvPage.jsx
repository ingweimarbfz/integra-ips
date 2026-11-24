import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdContactPage, MdCheckCircle, MdWarning, MdError, MdWork, MdDraw } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { PageHead, Card, Empty, Spinner } from '../components/ui'
import { VacationCard } from './talento/Vacations'
import { fmt, Percent } from './talento/common'
import { useAlerts } from '../context/AlertsContext'

// IIPS-026 · Mi hoja de vida: el panel de cada usuario con lo de su hoja de vida (requisitos, soportes
// que faltan o vencen, contrato y vacaciones) y sus pendientes (documentos por firmar y avisos).
const STATUS = { vigente: ['Al día', 'ok', <MdCheckCircle key="o" />], por_vencer: ['Por vencer', 'warn', <MdWarning key="w" />], vencido: ['Vencido', 'bad', <MdError key="b" />], faltante: ['Falta', 'bad', <MdError key="f" />] }

const MyCvPage = () => {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const { countFor, data: alerts } = useAlerts()
  useEffect(() => { api.get('/mi-hoja-de-vida', { noCache: true }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e))) }, [])
  if (error) return <div className="alert bad">{error}</div>
  if (!d) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const s = d.staff
  const pendingSign = countFor('/firma')
  return (
    <>
      <PageHead title="Mi hoja de vida" subtitle="Tus requisitos, soportes, contrato, vacaciones y pendientes." />
      <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 18 }}>
        <Card title="Mis pendientes" icon={<MdDraw style={{ color: 'var(--brand)' }} />}>
          <ul className="list">
            <li><div className="grow"><strong>Documentos por firmar</strong><span>{pendingSign ? `Tienes ${pendingSign} pendiente${pendingSign === 1 ? '' : 's'}` : 'Nada pendiente'}</span></div><Link className="btn btn-outline btn-sm" to="/firma">Ir a firmar</Link></li>
            <li><div className="grow"><strong>Avisos del sistema</strong><span>{alerts?.total ? `${alerts.total} en la campana` : 'Sin avisos'}</span></div></li>
          </ul>
        </Card>
        {s ? (
          <Card title={s.fullName} subtitle={[s.positionName, s.dependencyName || (s.scope === 'ips' ? 'IPS' : null), s.siteName].filter(Boolean).join(' · ')} icon={<MdContactPage style={{ color: 'var(--brand)' }} />}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <Percent value={s.compliance.percent} />
              <div className="stack" style={{ gap: 4 }}>
                <span>{s.compliance.ok} de {s.compliance.mandatory} requisitos obligatorios al día</span>
                {s.compliance.missing > 0 && <span style={{ color: 'var(--bad)' }}>Te faltan {s.compliance.missing} soporte{s.compliance.missing === 1 ? '' : 's'}</span>}
                {s.compliance.expired > 0 && <span style={{ color: 'var(--bad)' }}>{s.compliance.expired} vencido{s.compliance.expired === 1 ? '' : 's'}</span>}
                <span><MdWork style={{ verticalAlign: '-2px' }} /> {s.contract ? `${s.contract.contractTypeLabel}${s.contract.endDate ? ` · hasta ${fmt(s.contract.endDate)}` : ''}` : 'Sin contrato registrado'}</span>
              </div>
            </div>
          </Card>
        ) : <Card><Empty icon={<MdContactPage />}>Aún no tienes una hoja de vida registrada. Talento humano la crea con tu número de documento.</Empty></Card>}
      </div>
      {s && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Card flush title="Mis requisitos" subtitle="Lo que debe tener tu carpeta según tu cargo">
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Requisito</th><th>Estado</th><th>Vence</th></tr></thead>
              <tbody>{s.compliance.items.map((i) => { const st = STATUS[i.status] || STATUS.faltante; return (
                <tr key={i.requirementTypeId}><td>{i.name}{!i.mandatory && <small style={{ color: 'var(--muted)' }}> (opcional)</small>}</td><td><span className={`badge ${st[1]}`}>{st[2]} {st[0]}</span></td><td>{i.expiryDate ? fmt(i.expiryDate) : '—'}</td></tr>
              ) })}</tbody>
            </table></div>
          </Card>
          <VacationCard staffId={s.id} initial={d.vacation} readOnly />
        </div>
      )}
    </>
  )
}

export default MyCvPage
