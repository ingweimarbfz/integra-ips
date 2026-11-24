import React, { useEffect, useState } from 'react'
import { MdViewModule, MdErrorOutline } from 'react-icons/md'
import api, { errorMessage } from '../api/client'
import { Card, Spinner, useToast } from '../components/ui'

// IIPS-021 · Módulos opcionales: la organización puede apagar los que no usa (p. ej. Facturación).
// Se oculta el menú y las pantallas; los servicios que facturan (citologías, vacunas) se registran igual, sin factura.
const ModulesCard = () => {
  const [toast, toastNode] = useToast()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')
  useEffect(() => { api.get('/configuracion/modulos').then(({ data }) => setRows(data.options)).catch((e) => setError(errorMessage(e))) }, [])
  const toggle = async (key, enabled) => {
    setSaving(key); setError('')
    try {
      const { data } = await api.put('/configuracion/modulos', { enabled: { [key]: enabled } })
      setRows(data.options)
      // Recarga el usuario para que el menú se actualice de inmediato.
      window.dispatchEvent(new Event('focus'))
      toast(enabled ? 'Módulo activado' : 'Módulo ocultado')
    } catch (e) { setError(errorMessage(e)) } finally { setSaving('') }
  }
  return (
    <Card title="Módulos opcionales" subtitle="Oculta los módulos que tu organización no usa. Los registros de los demás módulos no se afectan." icon={<MdViewModule style={{ color: 'var(--brand)' }} />}>
      {!rows ? (error ? null : <Spinner />) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map((m) => (
            <label key={m.key} className={`rc-check${m.enabled ? ' on' : ''}`} style={{ justifyContent: 'space-between' }}>
              <span><b>{m.label}</b><br /><small style={{ color: 'var(--muted)' }}>{m.key === 'facturacion' ? (m.enabled ? 'Visible en el menú de IPS.' : 'Oculto. Las citologías quedan "por facturar" y las vacunas se registran sin factura.') : null}</small></span>
              {saving === m.key ? <Spinner /> : <input type="checkbox" checked={m.enabled} onChange={(e) => toggle(m.key, e.target.checked)} aria-label={`Usar ${m.label}`} />}
            </label>
          ))}
        </div>
      )}
      {error && <div className="alert bad" style={{ marginTop: 12 }}><MdErrorOutline /><span>{error}</span></div>}
      {toastNode}
    </Card>
  )
}

export default ModulesCard
