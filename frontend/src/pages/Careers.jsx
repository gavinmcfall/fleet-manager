import React, { useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Briefcase, Target, ChevronDown, ChevronRight } from 'lucide-react'

const FILTERED_NAMES = ['<= PLACEHOLDER =>', 'haymaker']

const CAREER_COLORS = [
  { text: 'text-red-400', border: 'border-red-400/60', bg: 'bg-red-400/10' },
  { text: 'text-amber-400', border: 'border-amber-400/60', bg: 'bg-amber-400/10' },
  { text: 'text-emerald-400', border: 'border-emerald-400/60', bg: 'bg-emerald-400/10' },
  { text: 'text-cyan-400', border: 'border-cyan-400/60', bg: 'bg-cyan-400/10' },
  { text: 'text-blue-400', border: 'border-blue-400/60', bg: 'bg-blue-400/10' },
  { text: 'text-violet-400', border: 'border-violet-400/60', bg: 'bg-violet-400/10' },
  { text: 'text-pink-400', border: 'border-pink-400/60', bg: 'bg-pink-400/10' },
  { text: 'text-orange-400', border: 'border-orange-400/60', bg: 'bg-orange-400/10' },
  { text: 'text-lime-400', border: 'border-lime-400/60', bg: 'bg-lime-400/10' },
  { text: 'text-teal-400', border: 'border-teal-400/60', bg: 'bg-teal-400/10' },
  { text: 'text-indigo-400', border: 'border-indigo-400/60', bg: 'bg-indigo-400/10' },
]

function getCareerColor(index) {
  return CAREER_COLORS[index % CAREER_COLORS.length]
}

const SIZE_STYLES = {
  small: 'bg-emerald-900/40 text-emerald-300',
  medium: 'bg-blue-900/40 text-blue-300',
  large: 'bg-amber-900/40 text-amber-300',
  capital: 'bg-red-900/40 text-red-300',
}

function SizeBadge({ size }) {
  if (!size) return null
  const style = SIZE_STYLES[size.toLowerCase()] || 'bg-gray-700 text-gray-300'
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${style}`}>
      {size}
    </span>
  )
}

function MiniVehicleCard({ vehicle }) {
  return (
    <Link
      to={`/ships/${vehicle.slug}`}
      className="panel p-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors group"
    >
      {vehicle.image_url ? (
        <img
          src={vehicle.image_url}
          alt={vehicle.name}
          className="w-12 h-8 object-contain shrink-0 rounded"
          loading="lazy"
        />
      ) : (
        <div className="w-12 h-8 bg-gray-800 rounded shrink-0 flex items-center justify-center">
          <span className="text-gray-600 text-[8px] font-mono">N/A</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white font-medium truncate group-hover:text-sc-accent transition-colors">
          {vehicle.name}
        </div>
        <div className="text-[11px] text-gray-500 truncate">
          {vehicle.manufacturer_name}
        </div>
      </div>
      <SizeBadge size={vehicle.size_label} />
    </Link>
  )
}

function ExpandableCard({ name, icon: Icon, vehicleCount, vehicles, colorClasses, subtitle }) {
  const [expanded, setExpanded] = useState(false)
  const ChevronIcon = expanded ? ChevronDown : ChevronRight

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`panel p-4 w-full flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left border-l-2 ${colorClasses?.border || 'border-sc-accent/60'}`}
      >
        <Icon className={`w-5 h-5 shrink-0 ${colorClasses?.text || 'text-sc-accent'}`} />
        <span className="font-display font-semibold text-white text-sm flex-1">{name}</span>
        {subtitle && (
          <span className="text-[11px] text-gray-500 font-mono mr-2">{subtitle}</span>
        )}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${colorClasses?.bg || 'bg-sc-accent/10'} ${colorClasses?.text || 'text-sc-accent'}`}>
          {vehicleCount}
        </span>
        <ChevronIcon className="w-4 h-4 text-gray-500 shrink-0" />
      </button>
      {expanded && vehicles && vehicles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 ml-3">
          {vehicles.map((v) => (
            <MiniVehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      )}
      {expanded && (!vehicles || vehicles.length === 0) && (
        <div className="ml-3 mt-2 panel p-4 text-center text-gray-500 text-xs font-mono">
          No vehicles assigned
        </div>
      )}
    </div>
  )
}

export default function Careers() {
  const { data, loading, error, refetch } = useAPI('/gamedata/careers')
  const search = searchParams.get('search') || ''
  const setSearch = useCallback((val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (val) {
        next.set('search', val)
      } else {
        next.delete('search')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])
  const VALID_TABS = ['careers', 'roles']
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'careers'
  const setActiveTab = useCallback((t) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (t === 'careers') next.delete('tab')
      else next.set('tab', t)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const { filteredCareers, filteredRoles, hasResults } = useMemo(() => {
    if (!data) return { filteredCareers: [], filteredRoles: [], hasResults: false }

    const careers = (data.careers || []).filter(
      (c) => !FILTERED_NAMES.some((f) => c.name.toLowerCase() === f.toLowerCase())
        && (c.vehicle_count > 0 || (c.vehicles && c.vehicles.length > 0))
    )
    const roles = (data.roles || []).filter(
      (r) => !FILTERED_NAMES.some((f) => r.name.toLowerCase() === f.toLowerCase())
    )
    const q = search.toLowerCase().trim()

    const matchedCareers = q
      ? careers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.vehicles || []).some((v) => v.name.toLowerCase().includes(q))
        )
      : careers

    const matchedRoles = q
      ? roles.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.vehicles || []).some((v) => v.name.toLowerCase().includes(q))
        )
      : roles

    return {
      filteredCareers: matchedCareers,
      filteredRoles: matchedRoles,
      hasResults: matchedCareers.length > 0 || matchedRoles.length > 0,
    }
  }, [data, search])

  const totalCareers = data?.careers?.filter(
    (c) => !FILTERED_NAMES.some((f) => c.name.toLowerCase() === f.toLowerCase())
  ).length || 0
  const totalRoles = data?.roles?.filter(
    (r) => !FILTERED_NAMES.some((f) => r.name.toLowerCase() === f.toLowerCase())
  ).length || 0

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const currentItems = activeTab === 'careers' ? filteredCareers : filteredRoles
  const noResults = activeTab === 'careers' ? filteredCareers.length === 0 : filteredRoles.length === 0

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Careers & Roles"
        subtitle={`${totalCareers} careers · ${totalRoles} roles`}
      />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('careers')}
          className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            activeTab === 'careers'
              ? 'border-sc-accent text-sc-accent'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Careers
          <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
            activeTab === 'careers' ? 'bg-sc-accent/20 text-sc-accent' : 'bg-gray-700 text-gray-400'
          }`}>
            {totalCareers}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            activeTab === 'roles'
              ? 'border-sc-accent text-sc-accent'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          Roles
          <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
            activeTab === 'roles' ? 'bg-sc-accent/20 text-sc-accent' : 'bg-gray-700 text-gray-400'
          }`}>
            {totalRoles}
          </span>
        </button>
      </div>

      {/* ── Search ── */}
      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${activeTab === 'careers' ? 'careers' : 'roles'} and vehicles...`}
        />
      </div>

      {/* ── No results ── */}
      {noResults && (
        <div className="panel p-8 text-center">
          <p className="text-gray-500 text-sm">No {activeTab} match your search.</p>
        </div>
      )}

      {/* ── Careers tab ── */}
      {activeTab === 'careers' && filteredCareers.length > 0 && (
        <section className="space-y-2">
          {filteredCareers.map((career, i) => (
            <ExpandableCard
              key={career.id}
              name={career.name}
              icon={Briefcase}
              vehicleCount={career.vehicle_count || 0}
              vehicles={career.vehicles}
              colorClasses={getCareerColor(i)}
            />
          ))}
        </section>
      )}

      {/* ── Roles tab ── */}
      {activeTab === 'roles' && filteredRoles.length > 0 && (
        <section className="space-y-2">
          {filteredRoles.map((role) => (
            <ExpandableCard
              key={role.id}
              name={role.name}
              icon={Target}
              vehicleCount={role.vehicle_count || 0}
              vehicles={role.vehicles}
              subtitle={role.vehicles?.[0]?.classification || null}
            />
          ))}
        </section>
      )}
    </div>
  )
}
