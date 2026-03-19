import React, { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Crosshair } from 'lucide-react'
import { usePlanner } from '../../hooks/useAPI'
import PageHeader from '../../components/PageHeader'
import LoadingState from '../../components/LoadingState'
import ErrorState from '../../components/ErrorState'
import BlueprintPicker from './BlueprintPicker'
import MaterialSlots from './MaterialSlots'
import MiningPlan from './MiningPlan'
import QualityImpact from './QualityImpact'

export default function CraftingPlanner() {
  const { data, loading, error, refetch } = usePlanner()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL state
  const selectedItemId = searchParams.get('item') ? Number(searchParams.get('item')) : null
  const selectedMaterial = searchParams.get('material') || null
  const selectedLocationId = searchParams.get('location') ? Number(searchParams.get('location')) : null
  const search = searchParams.get('q') || ''
  const typeFilter = searchParams.get('type') || ''
  const subtypeFilter = searchParams.get('subtype') || ''

  const setParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value != null && value !== '') {
        next.set(key, String(value))
      } else {
        next.delete(key)
      }
      return next
    })
  }, [setSearchParams])

  const handleSelectItem = useCallback((id) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (selectedItemId === id) {
        next.delete('item')
        next.delete('material')
        next.delete('location')
      } else {
        next.set('item', String(id))
        next.delete('material')
        next.delete('location')
      }
      return next
    })
  }, [selectedItemId, setSearchParams])

  const handleSelectMaterial = useCallback((name) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (selectedMaterial === name) {
        next.delete('material')
        next.delete('location')
      } else {
        next.set('material', name)
        next.delete('location')
      }
      return next
    })
  }, [selectedMaterial, setSearchParams])

  const handleSelectLocation = useCallback((id) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (selectedLocationId === id) {
        next.delete('location')
      } else {
        next.set('location', String(id))
      }
      return next
    })
  }, [selectedLocationId, setSearchParams])

  // Data
  const blueprints = data?.blueprints || []
  const resources = data?.resources || []
  const elements = data?.elements || []
  const compositions = data?.compositions || []
  const locations = data?.locations || []
  const equipment = data?.equipment || { lasers: [], modules: [], gadgets: [] }
  const qualityDistributions = data?.qualityDistributions || []
  const refining = data?.refining || []
  const resourceElementMap = data?.resourceElementMap || {}

  // Selected blueprint
  const selectedBlueprint = useMemo(() => {
    if (!selectedItemId) return null
    return blueprints.find(bp => bp.id === selectedItemId) || null
  }, [blueprints, selectedItemId])

  // Selected location
  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return null
    return locations.find(loc => loc.id === selectedLocationId) || null
  }, [locations, selectedLocationId])

  if (loading) return <LoadingState fullScreen message="Loading planner data..." />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-fade-in-up">
      <PageHeader
        title="MISSION PLANNER"
        subtitle="Craft &rarr; Mine &rarr; Equip &rarr; Quality"
        icon={Crosshair}
      />

      {/* Stage 1: Blueprint Picker (always visible) */}
      {!selectedBlueprint ? (
        <BlueprintPicker
          blueprints={blueprints}
          resources={resources}
          selectedId={selectedItemId}
          onSelect={handleSelectItem}
          search={search}
          onSearchChange={v => setParam('q', v)}
          typeFilter={typeFilter}
          onTypeChange={v => { setParam('type', v); setParam('subtype', '') }}
          subtypeFilter={subtypeFilter}
          onSubtypeChange={v => setParam('subtype', v)}
        />
      ) : (
        <>
          {/* Stage 2: Material Slots (visible when item selected) */}
          <MaterialSlots
            blueprint={selectedBlueprint}
            selectedMaterial={selectedMaterial}
            onSelectMaterial={handleSelectMaterial}
            resourceElementMap={resourceElementMap}
          />

          {/* Stage 3: Mining Plan (visible when material selected) */}
          {selectedMaterial && (
            <MiningPlan
              resourceName={selectedMaterial}
              locations={locations}
              compositions={compositions}
              elements={elements}
              equipment={equipment}
              resourceElementMap={resourceElementMap}
              selectedLocationId={selectedLocationId}
              onSelectLocation={handleSelectLocation}
            />
          )}

          {/* Stage 4: Quality Impact (visible when location selected) */}
          {selectedMaterial && selectedLocationId && selectedLocation && (
            <QualityImpact
              location={selectedLocation}
              qualityDistributions={qualityDistributions}
              refining={refining}
              blueprint={selectedBlueprint}
              selectedMaterial={selectedMaterial}
            />
          )}

          {/* Back button */}
          <button
            onClick={() => handleSelectItem(selectedItemId)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-4"
          >
            &larr; Back to blueprint selection
          </button>
        </>
      )}
    </div>
  )
}
