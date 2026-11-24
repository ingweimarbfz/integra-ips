// IIPS-028 · Variables de las plantillas de certificado: {{estudiante}}, {{documento}}, {{programa}}…
export const CERT_VARS = [
  ['estudiante', 'Nombre del estudiante'], ['tipo_documento', 'Tipo de documento'], ['documento', 'Número de documento'], ['programa', 'Programa'],
  ['ocupacion', 'Ocupación que acredita'], ['horas', 'Intensidad en horas'], ['motivo', '"cursado y aprobado" o "asistido y participado"'], ['fecha', 'Fecha de expedición'],
  ['ciudad', 'Ciudad'], ['institucion', 'Institución'], ['nit', 'NIT'], ['numero', 'Número del certificado'], ['codigo', 'Código de verificación'], ['registro', 'Registro del programa']
]
const longDate = (iso) => (iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`)) : '')
export const certVars = (c) => {
  const s = c.snapshot || {}
  return {
    estudiante: s.student?.name || '', tipo_documento: s.student?.docType || '', documento: s.student?.docNumber || '', programa: s.program?.name || '',
    ocupacion: s.program?.occupation || '', horas: Number(c.hours || 0).toLocaleString('es-CO'), motivo: c.certType === 'asistencia' ? 'asistido y participado en' : 'cursado y aprobado',
    fecha: longDate(c.issuedAt), ciudad: s.city || '', institucion: s.institution || '', nit: s.nit || '', numero: c.numberLabel || '', codigo: c.verificationCode || '', registro: s.program?.registrationNumber || ''
  }
}
// Reemplaza {{variable}} y **negrita**; devuelve partes para pintar en React sin HTML inyectado.
export const fill = (text, vars) => String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`))
export const richParts = (text) => String(text || '').split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? { b: true, t: p.slice(2, -2), k: i } : { b: false, t: p, k: i }))
export const DEFAULT_TEMPLATE = {
  name: 'Diploma institucional', orientation: 'landscape', titleText: '', introText: 'Otorgado a',
  bodyText: 'Por haber {{motivo}} el programa **{{programa}}**, que lo acredita como **{{ocupacion}}**, con una intensidad de **{{horas}} horas**, de conformidad con el Decreto 1075 de 2015.',
  closingText: 'Dado en {{ciudad}}, el {{fecha}}.', footerText: 'Certificado N.º {{numero}} · Código de verificación {{codigo}}',
  primaryColor: '#1F2A44', borderStyle: 'doble', showLogo: true, signers: [{ label: 'Dirección', name: '', useIssuer: true }, { label: 'Secretaría académica', name: '' }], isDefault: false, active: true
}
// Certificado de ejemplo para la vista previa.
export const SAMPLE_CERT = {
  title: 'Certificado de aptitud ocupacional', hours: 1200, certType: 'aprobacion', issuedAt: new Date().toISOString(), numberLabel: 'CERT-000123', verificationCode: 'AB12CD34',
  snapshot: { institution: 'Institución de ejemplo', nit: '900.000.000-1', city: 'Valledupar', student: { name: 'María Fernanda Pérez Gómez', docType: 'CC', docNumber: '1.065.000.000' }, program: { name: 'Auxiliar en enfermería', occupation: 'Auxiliar en enfermería', registrationNumber: 'Res. 0123 de 2024' } }
}
