import React from 'react'
import { Navigate } from 'react-router-dom'
import { useStatus } from '../hooks/useAPI'
import LoadingState from './LoadingState'

export default function RequireFeature({ flag, children }) {
  const { data: status, loading } = useStatus()

  if (loading) return <LoadingState />

  const enabled = status?.features?.[flag]
  if (!enabled) return <Navigate to="/404" replace />

  return children
}
