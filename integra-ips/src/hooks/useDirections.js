import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

// IIPS-023 · Áreas que dirige el usuario (para habilitar las casillas de firma de dirección).
const cache = new Map()
const useDirections = () => {
  const { user } = useAuth()
  const [areas, setAreas] = useState(() => cache.get(user?.id) || [])
  useEffect(() => {
    if (!user) return
    api.get('/mi-direccion').then(({ data }) => { cache.set(user.id, data.areas || []); setAreas(data.areas || []) }).catch(() => {})
  }, [user])
  return { areas, directs: (area) => areas.some((a) => a.area === area) }
}
export default useDirections
