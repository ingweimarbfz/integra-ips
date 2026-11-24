import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MdArrowBack, MdOpenInNew, MdErrorOutline, MdPeople, MdInfoOutline } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { Card, Spinner } from '../../components/ui'

// IIPS-028 · Aula virtual integrada (Jitsi): la clase se dicta dentro del sistema, sin enlaces externos.
// Queda registro de quién entró. El dominio se configura en Educación → Configuración (meet.jit.si o uno propio).
const VirtualClassroom = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const logged = useRef(false)
  useEffect(() => {
    api.get(`/academico/aula-virtual/${id}`, { noCache: true }).then(({ data }) => {
      setD(data)
      if (!logged.current) { logged.current = true; api.post(`/academico/aula-virtual/${id}/ingreso`).catch(() => {}) }
    }).catch((e) => setError(errorMessage(e)))
  }, [id])
  if (error) return <div className="alert bad"><MdErrorOutline /><span>{error}</span></div>
  if (!d) return <div className="splash" style={{ minHeight: 300 }}><Spinner /></div>
  const s = d.session
  const hash = [`userInfo.displayName="${encodeURIComponent(d.displayName)}"`, d.email ? `userInfo.email="${encodeURIComponent(d.email)}"` : null, 'config.prejoinConfig.enabled=false', `config.subject="${encodeURIComponent(`${s.subject || 'Clase'} · ${s.group?.code || ''}`)}"`].filter(Boolean).join('&')
  const url = `https://${d.domain}/${d.room}#${hash}`
  const publicJitsi = d.domain === 'meet.jit.si'
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><MdArrowBack /> Volver</button>
        <div><strong>{s.subject} · {s.group?.code}</strong> <span style={{ color: 'var(--muted)' }}>{s.date.split('-').reverse().join('/')} · {s.startTime}–{s.endTime} · {s.teacher || ''}</span></div>
        <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noreferrer"><MdOpenInNew /> Abrir en ventana nueva</a>
      </div>
      {publicJitsi && <div className="alert info" style={{ margin: 0 }}><MdInfoOutline /><span>Se usa el servidor público meet.jit.si: dentro del sistema la llamada se corta a los 5 minutos y el docente debe iniciar sesión para abrir la sala. Para clases largas usa «Abrir en ventana nueva» o configura un servidor Jitsi propio (o JaaS) en Educación → Configuración.</span></div>}
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 220px)', minHeight: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: '#111' }}>
        <iframe title="Aula virtual" src={url} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write" style={{ width: '100%', height: '100%', border: 0 }} />
      </div>
      {d.as === 'docente' && (
        <Card title={`Ingresos al aula (${d.joins.length})`} icon={<MdPeople style={{ color: 'var(--brand)' }} />}>
          {d.joins.length === 0 ? <span className="hint">Aún no ha entrado nadie.</span> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{d.joins.map((j) => <span key={j.userId} className="badge" title={`Primer ingreso ${new Date(j.first).toLocaleTimeString('es-CO')}`}>{j.name}{j.role === 'estudiante' ? '' : ` (${j.role})`}</span>)}</div>
          )}
          <span className="hint" style={{ display: 'block', marginTop: 8 }}>La asistencia se sigue tomando en la clase; esta lista ayuda a verificar quién se conectó.</span>
        </Card>
      )}
    </div>
  )
}

export default VirtualClassroom
