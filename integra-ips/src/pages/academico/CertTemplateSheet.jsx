import React from 'react'
import { certVars, fill, richParts } from './certTemplate'

const Rich = ({ text }) => richParts(text).map((p) => (p.b ? <b key={p.k}>{p.t}</b> : <React.Fragment key={p.k}>{p.t}</React.Fragment>))
const BORDER = { doble: (c) => `6px double ${c}`, simple: (c) => `2px solid ${c}`, ninguno: () => 'none' }

// IIPS-028 · Certificado dibujado con una plantilla (orientación, textos con variables, color, fondo y firmas).
const CertTemplateSheet = React.forwardRef(({ t, c, logo, voided, style }, ref) => {
  const v = certVars(c)
  const color = t.primaryColor || '#1F2A44'
  const landscape = t.orientation !== 'portrait'
  return (
    <article ref={ref} className={`cy-sheet cert-sheet ${landscape ? 'sheet-landscape' : ''}`}
      style={{ position: 'relative', textAlign: 'center', padding: landscape ? '14mm 18mm' : '20mm 16mm', border: BORDER[t.borderStyle || 'doble'](color), backgroundImage: t.backgroundUrl ? `url(${t.backgroundUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', ...style }}>
      {voided && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 110, fontWeight: 800, color: 'rgba(220,38,38,.15)', transform: 'rotate(-18deg)', pointerEvents: 'none' }}>ANULADO</div>}
      {t.showLogo !== false && logo && <img src={logo} alt={v.institucion} style={{ maxHeight: 70, maxWidth: 240, objectFit: 'contain' }} />}
      <p style={{ margin: '4mm 0 0', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280' }}>{v.institucion}{v.nit ? ` · NIT ${v.nit}` : ''}</p>
      <h1 style={{ margin: '8mm 0 2mm', fontFamily: 'Georgia, serif', fontSize: 30, color }}>{fill(t.titleText, v) || c.title}</h1>
      {t.introText && <p style={{ margin: 0, fontSize: 14 }}>{fill(t.introText, v)}</p>}
      <p style={{ margin: '3mm 0 1mm', fontSize: 26, fontWeight: 700 }}>{v.estudiante}</p>
      <p style={{ margin: 0, fontSize: 13 }}>{v.tipo_documento} {v.documento}</p>
      <p style={{ margin: '6mm auto 0', maxWidth: landscape ? '200mm' : '160mm', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}><Rich text={fill(t.bodyText, v)} /></p>
      {t.closingText && <p style={{ margin: '4mm 0 0', fontSize: 13 }}><Rich text={fill(t.closingText, v)} /></p>}
      {t.signers?.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', marginTop: '12mm', gap: '10mm', flexWrap: 'wrap' }}>
          {t.signers.map((s, i) => (
            <div key={i} style={{ minWidth: '60mm' }}>
              {s.signatureUrl ? <img src={s.signatureUrl} alt="Firma" style={{ maxHeight: 55, maxWidth: '100%', objectFit: 'contain' }} /> : <div style={{ height: 55 }} />}
              <div style={{ borderTop: '1px solid #111', paddingTop: 2 }}><b>{s.name || s.label}</b>{s.name && s.label ? <div style={{ fontSize: 11 }}>{s.label}</div> : null}</div>
            </div>
          ))}
        </div>
      )}
      {t.footerText && <div style={{ marginTop: '8mm', fontSize: 10.5, color: '#6b7280' }}><Rich text={fill(t.footerText, v)} /></div>}
    </article>
  )
})
CertTemplateSheet.displayName = 'CertTemplateSheet'
export default CertTemplateSheet
