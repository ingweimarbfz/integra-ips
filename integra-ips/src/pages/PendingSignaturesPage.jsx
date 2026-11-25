import React from 'react'
import { Link } from 'react-router-dom'
import { MdDraw } from 'react-icons/md'
import { PageHead } from '../components/ui'
import PendingSignatures from '../components/PendingSignatures'

// IIPS-036 · Todos los documentos que el usuario tiene pendientes por firmar (también los de director de área).
const PendingSignaturesPage = () => (
  <>
    <PageHead title="Documentos por firmar" subtitle="Lo que espera tu firma: reportes, listas de chequeo, actas y, si eres director, los documentos de tu área.">
      <Link className="btn btn-outline" to="/firma"><MdDraw /> Mi firma digital</Link>
    </PageHead>
    <PendingSignatures />
  </>
)
export default PendingSignaturesPage
