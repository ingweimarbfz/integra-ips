import React, { useCallback, useEffect, useState } from 'react'
import { MdAdd, MdSave, MdDelete, MdErrorOutline, MdWorkspacePremium, MdImage, MdStar } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useSettings } from '../../context/SettingsContext'
import { PageHead, Card, Empty, Spinner, useToast } from '../../components/ui'
import { resizeImage } from '../../utils/image'
import CertTemplateSheet from './CertTemplateSheet'
import { CERT_VARS, DEFAULT_TEMPLATE, SAMPLE_CERT } from './certTemplate'
import '../../components/cytology.css'

// IIPS-028 · Plantillas de certificado: cada institución (o cliente) arma la suya con textos, variables,
// color, fondo y firmas; se asigna a cada programa o queda como predeterminada.
const CertTemplates = () => {
  const { logo, settings } = useSettings()
  const [toast, toastNode] = useToast()
  const [list, setList] = useState(null)
  const [programs, setPrograms] = useState([])
  const [users, setUsers] = useState([])
  const [f, setF] = useState(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const load = useCallback(() => api.get('/academico/plantillas-certificado', { noCache: true }).then(({ data }) => setList(data)).catch((e) => setError(errorMessage(e))), [])
  useEffect(() => {
    load()
    api.get('/academico/programas').then(({ data }) => setPrograms(Array.isArray(data) ? data : data.rows || [])).catch(() => {})
    api.get('/firmas/usuarios').then(({ data }) => setUsers(data.filter((u) => u.active))).catch(() => {})
  }, [load])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setSigner = (i, k, v) => setF((x) => ({ ...x, signers: x.signers.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }))
  const save = async () => {
    setError(''); setSaving(true)
    try {
      const { data } = f.id ? await api.put(`/academico/plantillas-certificado/${f.id}`, f) : await api.post('/academico/plantillas-certificado', f)
      setF({ ...f, ...data }); toast('Plantilla guardada'); load()
    } catch (e) { setError(errorMessage(e)) } finally { setSaving(false) }
  }
  const remove = async () => { try { await api.delete(`/academico/plantillas-certificado/${f.id}`); setF(null); toast('Plantilla eliminada'); load() } catch (e) { toast(errorMessage(e), 'bad') } }
  const background = async (file) => {
    if (!f.id) return toast('Guarda la plantilla antes de cargar el fondo', 'bad')
    try { const image = file ? await resizeImage(file, { max: 2200, type: 'image/jpeg', quality: 0.85 }) : null; const { data } = await api.post(`/academico/plantillas-certificado/${f.id}/fondo`, { image }); setF({ ...f, backgroundUrl: data.backgroundUrl }); load() } catch (e) { toast(errorMessage(e), 'bad') }
  }
  const assign = async (programId, templateId) => { try { await api.put(`/academico/programas/${programId}/plantilla-certificado`, { templateId }); toast('Plantilla asignada al programa') ; setPrograms((ps) => ps.map((p) => (p.id === programId ? { ...p, certificateTemplateId: templateId } : p))) } catch (e) { toast(errorMessage(e), 'bad') } }
  // Vista previa con la firma digital de los firmantes elegidos.
  const preview = f && { ...f, signers: f.signers.map((s) => ({ ...s, signatureUrl: s.userId ? users.find((u) => u.id === Number(s.userId))?.signatureUrl : null, name: s.name || (s.userId ? users.find((u) => u.id === Number(s.userId))?.fullName : '') })) }
  return (
    <>
      <PageHead title="Plantillas de certificado" subtitle="Diseña el certificado de cada programa: textos con variables, color, fondo y firmas. Sin plantilla se usa el diseño institucional.">
        <button type="button" className="btn btn-primary" onClick={() => setF({ ...DEFAULT_TEMPLATE, signers: DEFAULT_TEMPLATE.signers.map((s) => ({ ...s })) })}><MdAdd /> Nueva plantilla</button>
      </PageHead>
      {error && <div className="alert bad" style={{ marginBottom: 12 }}><MdErrorOutline /><span>{error}</span></div>}
      <div className="grid grid-2-1" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {f ? (
            <Card title={f.id ? `Editar · ${f.name}` : 'Nueva plantilla'} actions={<>{f.id && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={remove}><MdDelete /> Eliminar</button>}<button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <Spinner /> : <MdSave />} Guardar</button></>}>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="field"><label>Nombre</label><input value={f.name} onChange={set('name')} /></div>
                <div className="field"><label>Orientación</label><select value={f.orientation} onChange={set('orientation')}><option value="landscape">Horizontal</option><option value="portrait">Vertical</option></select></div>
                <div className="field span-all"><label>Título (vacío = título del certificado)</label><input value={f.titleText || ''} onChange={set('titleText')} placeholder="Ej. Certificado de aptitud ocupacional" /></div>
                <div className="field span-all"><label>Introducción</label><input value={f.introText || ''} onChange={set('introText')} /></div>
                <div className="field span-all"><label>Texto del certificado</label><textarea rows={4} value={f.bodyText} onChange={set('bodyText')} /><span className="hint">Usa **texto** para negrita y las variables de la lista.</span></div>
                <div className="field span-all"><label>Cierre</label><input value={f.closingText || ''} onChange={set('closingText')} /></div>
                <div className="field span-all"><label>Pie de página</label><input value={f.footerText || ''} onChange={set('footerText')} /></div>
                <div className="field"><label>Color principal</label><input type="color" value={f.primaryColor} onChange={set('primaryColor')} style={{ height: 40 }} /></div>
                <div className="field"><label>Borde</label><select value={f.borderStyle} onChange={set('borderStyle')}><option value="doble">Doble</option><option value="simple">Simple</option><option value="ninguno">Sin borde</option></select></div>
                <div className="field"><label className="switch"><input type="checkbox" checked={f.showLogo !== false} onChange={set('showLogo')} /> Mostrar logo</label></div>
                <div className="field"><label className="switch"><input type="checkbox" checked={Boolean(f.isDefault)} onChange={set('isDefault')} /> Predeterminada</label></div>
                <div className="field span-all"><label>Fondo (imagen)</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label className="btn btn-outline btn-sm"><MdImage /> {f.backgroundUrl ? 'Cambiar fondo' : 'Cargar fondo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => background(e.target.files[0])} /></label>
                    {f.backgroundUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={() => background(null)}>Quitar fondo</button>}
                  </div></div>
                <div className="field span-all"><label>Firmas (máximo 4)</label>
                  {f.signers.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                      <input value={s.label} onChange={(e) => setSigner(i, 'label', e.target.value)} placeholder="Cargo (ej. Director)" />
                      <input value={s.name} onChange={(e) => setSigner(i, 'name', e.target.value)} placeholder="Nombre (opcional)" />
                      <select value={s.useIssuer ? 'emisor' : s.userId || ''} onChange={(e) => setF((x) => ({ ...x, signers: x.signers.map((y, j) => (j === i ? { ...y, useIssuer: e.target.value === 'emisor', userId: e.target.value === 'emisor' ? null : Number(e.target.value) || null } : y)) }))}>
                        <option value="">Sin firma digital</option><option value="emisor">Firma de quien expide</option>
                        {users.filter((u) => u.signatureUrl).map((u) => <option key={u.id} value={u.id}>Firma de {u.fullName}</option>)}
                      </select>
                      <button type="button" className="btn btn-ghost btn-icon" aria-label="Quitar" onClick={() => setF({ ...f, signers: f.signers.filter((_, j) => j !== i) })}><MdDelete /></button>
                    </div>
                  ))}
                  {f.signers.length < 4 && <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, signers: [...f.signers, { label: '', name: '' }] })}><MdAdd /> Agregar firma</button>}
                </div>
              </div>
            </Card>
          ) : (
            <Card flush title="Plantillas" icon={<MdWorkspacePremium style={{ color: 'var(--brand)' }} />}>
              {!list ? <Spinner /> : list.length === 0 ? <Empty icon={<MdWorkspacePremium />}>Aún no hay plantillas. Se usa el diseño institucional.</Empty> : (
                <ul className="list" style={{ padding: '4px 20px 8px' }}>{list.map((t) => (
                  <li key={t.id} style={{ cursor: 'pointer' }} onClick={() => setF({ ...t, signers: (t.signers || []).map((s) => ({ ...s })) })}><div className="grow"><strong>{t.name} {t.isDefault && <span className="badge ok"><MdStar /> Predeterminada</span>}</strong><span>{t.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {t.signers?.length || 0} firma(s)</span></div></li>
                ))}</ul>
              )}
            </Card>
          )}
          {list?.length > 0 && programs.length > 0 && (
            <Card flush title="Plantilla de cada programa">
              <div className="table-wrap"><table className="table"><thead><tr><th>Programa</th><th>Plantilla</th></tr></thead>
                <tbody>{programs.map((p) => <tr key={p.id}><td>{p.name}</td><td><select value={p.certificateTemplateId || ''} onChange={(e) => assign(p.id, Number(e.target.value) || null)}><option value="">La predeterminada</option>{list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td></tr>)}</tbody></table></div>
            </Card>
          )}
          {f && <button type="button" className="btn btn-ghost" onClick={() => setF(null)}>← Ver todas las plantillas</button>}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          {preview && (
            <Card title="Vista previa (datos de ejemplo)">
              <div style={{ overflow: 'hidden', height: preview.orientation === 'portrait' ? 470 : 300 }}>
                <div style={{ transform: `scale(${preview.orientation === 'portrait' ? 0.5 : 0.42})`, transformOrigin: 'top left' }}>
                  <CertTemplateSheet t={preview} c={SAMPLE_CERT} logo={settings?.eduLogoUrl || logo} />
                </div>
              </div>
            </Card>
          )}
          <Card title="Variables disponibles">
            <ul className="list" style={{ fontSize: 12.5 }}>{CERT_VARS.map(([k, l]) => <li key={k}><div className="grow"><strong><code>{`{{${k}}}`}</code></strong><span>{l}</span></div></li>)}</ul>
          </Card>
        </div>
      </div>
      {toastNode}
    </>
  )
}

export default CertTemplates
