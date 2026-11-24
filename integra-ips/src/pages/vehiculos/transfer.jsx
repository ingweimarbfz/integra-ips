import React from 'react'
import { sanitize, check } from '../../utils/validate'
import api from '../../api/client'

// Datos del traslado asistencial (ambulancias TAB/TAM).
export const DOC_TYPES = { CC: 'Cédula de ciudadanía', TI: 'Tarjeta de identidad', RC: 'Registro civil', CE: 'Cédula de extranjería', PA: 'Pasaporte', PPT: 'Permiso por protección temporal', MS: 'Menor sin identificación', AS: 'Adulto sin identificación' }
export const REGIMES = { contributivo: 'Contributivo', subsidiado: 'Subsidiado', especial: 'Especial / excepción', particular: 'Particular', soat: 'SOAT (accidente de tránsito)', otro: 'Otro' }
export const PRIORITIES = { urgente: ['Urgente', 'bad'], prioritario: ['Prioritario', 'warn'], programado: ['Programado', 'ok'] }
export const TRANSFER_TYPES = { primario: 'Primario (desde el sitio del evento)', secundario: 'Secundario (entre IPS / remisión)' }
export const CONDITIONS = { estable: 'Estable', inestable: 'Inestable', critico: 'Crítico' }
export const SEX = { F: 'Femenino', M: 'Masculino', I: 'Indeterminado' }

export const EMPTY_TRANSFER = {
  patientName: '', documentType: 'CC', document: '', sex: '', ageYears: '', phone: '', eps: '', regime: '', transferType: '', priority: '',
  origin: '', destination: '', diagnosis: '', patientCondition: '', companionName: '', companionPhone: '', authorizationNumber: '', receivingProfessional: '', notes: ''
}
const REQUIRED = [['patientName', 'nombre del paciente'], ['document', 'identificación'], ['eps', 'EPS'], ['regime', 'régimen'], ['transferType', 'tipo de traslado'], ['priority', 'prioridad'], ['origin', 'origen'], ['destination', 'destino'], ['diagnosis', 'diagnóstico o motivo']]
export const missingTransfer = (t) => [
  ...REQUIRED.filter(([k]) => !String(t[k] || '').trim()).map(([, l]) => l),
  ...[['identificación válida', check.doc(t.document, t.documentType)], ['teléfono del paciente de 10 dígitos', check.phone(t.phone)], ['teléfono del acompañante de 10 dígitos', check.phone(t.companionPhone)]].filter(([, m]) => m).map(([l]) => l)
]

const Sel = ({ label, req, value, onChange, options }) => (
  <div className="field"><label>{label} {req && <span className="req">*</span>}</label>
    <select value={value} onChange={onChange}><option value="">Selecciona…</option>{Object.entries(options).map(([k, l]) => <option key={k} value={k}>{Array.isArray(l) ? l[0] : l}</option>)}</select></div>
)

export const TransferFields = ({ value, onChange }) => {
  const CLEAN = { phone: sanitize.phone, companionPhone: sanitize.phone, document: (v) => sanitize.doc(v, value.documentType) }
  const set = (k) => (e) => onChange({ ...value, [k]: CLEAN[k] ? CLEAN[k](e.target.value) : e.target.value })
  const txt = (k, label, req, props = {}) => <div className={`field${props.wide ? ' span-all' : ''}`}><label>{label} {req && <span className="req">*</span>}</label><input value={value[k]} onChange={set(k)} placeholder={props.placeholder} inputMode={props.inputMode} maxLength={props.maxLength} /></div>
  return (
    <div className="transfer-box">
      <p className="transfer-title">Paciente</p>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {txt('patientName', 'Nombre completo', true, { wide: true })}
        <Sel label="Tipo de documento" req value={value.documentType} onChange={set('documentType')} options={DOC_TYPES} />
        {txt('document', 'Número de identificación', true, { inputMode: 'numeric', placeholder: '1065123456' })}
        <Sel label="Sexo" value={value.sex} onChange={set('sex')} options={SEX} />
        <div className="field"><label>Edad (años)</label><input type="number" min="0" max="120" value={value.ageYears} onChange={set('ageYears')} /></div>
        {txt('eps', 'EPS / aseguradora', true, { placeholder: 'Ej. Nueva EPS' })}
        <Sel label="Régimen" req value={value.regime} onChange={set('regime')} options={REGIMES} />
        {txt('phone', 'Teléfono del paciente', false, { inputMode: 'numeric', maxLength: 10, placeholder: '3001234567' })}
        <Sel label="Condición del paciente" value={value.patientCondition} onChange={set('patientCondition')} options={CONDITIONS} />
      </div>
      <p className="transfer-title">Traslado</p>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Sel label="Tipo de traslado" req value={value.transferType} onChange={set('transferType')} options={TRANSFER_TYPES} />
        <Sel label="Prioridad" req value={value.priority} onChange={set('priority')} options={PRIORITIES} />
        {txt('origin', 'Origen (lugar de recogida)', true, { wide: true, placeholder: 'Dirección, vía o IPS remitente' })}
        {txt('destination', 'Destino (IPS receptora)', true, { wide: true })}
        <div className="field span-all"><label>Diagnóstico o motivo del traslado <span className="req">*</span></label><textarea value={value.diagnosis} onChange={set('diagnosis')} style={{ minHeight: 60 }} /></div>
        {txt('authorizationNumber', 'N.º de autorización / remisión')}
        {txt('receivingProfessional', 'Profesional que recibe')}
        {txt('companionName', 'Acompañante')}
        {txt('companionPhone', 'Teléfono del acompañante', false, { inputMode: 'numeric', maxLength: 10, placeholder: '3001234567' })}
        {txt('notes', 'Observaciones del traslado', false, { wide: true })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- IIPS-025 · Tripulación
// Busca un usuario registrado (por nombre o documento) para el rol indicado.
export const UserPicker = ({ label, value, onChange, rol, required, hint }) => {
  const [q, setQ] = React.useState('')
  const [rows, setRows] = React.useState([])
  React.useEffect(() => {
    if (q.trim().length < 3) { setRows([]); return undefined }
    const t = setTimeout(() => api.get('/vehiculos/tripulacion/buscar', { params: { q: q.trim(), rol } }).then(({ data }) => setRows(data)).catch(() => setRows([])), 250)
    return () => clearTimeout(t)
  }, [q, rol])
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      {value ? (
        <div className="picked-user"><span><b>{value.fullName}</b> · {value.identification || 's/d'}{value.roleLabel ? ` · ${value.roleLabel}` : ''}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Cambiar</button></div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento (mínimo 3 caracteres)" />
          {rows.length > 0 && <div className="picker-list">{rows.map((u) => <button key={u.id} type="button" onClick={() => { onChange(u); setQ('') }}><b>{u.fullName}</b> <small>{u.identification} · {u.roleLabel}{u.siteName ? ` · ${u.siteName}` : ''}</small></button>)}</div>}
          {q.trim().length >= 3 && rows.length === 0 && <span className="hint">Sin resultados. La persona debe estar registrada como usuario.</span>}
        </>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// TAB: auxiliar de traslado. TAM: auxiliar y médico. En un servicio, el auxiliar es opcional.
export const CrewFields = ({ value, onChange, type, optional }) => (
  <div className="grid grid-2" style={{ gap: 12 }}>
    <UserPicker label="Auxiliar de traslado" required={!optional} value={value.auxiliar} onChange={(u) => onChange({ ...value, auxiliar: u })} hint={optional ? 'Si va un auxiliar, queda también en el personal del servicio.' : undefined} />
    {(type === 'TAM' || value.medico) && <UserPicker label="Médico" required={type === 'TAM' && !optional} value={value.medico} onChange={(u) => onChange({ ...value, medico: u })} />}
  </div>
)
export const crewPayload = (c) => [c.auxiliar && { userId: c.auxiliar.id, role: 'auxiliar' }, c.medico && { userId: c.medico.id, role: 'medico' }].filter(Boolean)
