import React, { useState, useMemo } from 'react'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Briefcase, Target } from 'lucide-react'

const CAREER_COLORS = [
  'text-red-400',
  'text-amber-400',
  'text-emerald-400',
  'text-cyan-400',
  'text-blue-400',
  'text-violet-400',
  'text-pink-400',
  'text-orange-400',
  'text-lime-400',
  'text-teal-400',
  'text-indigo-400',
]

function getCareerColor(index) {
  return CAREER_COLORS[index % CAREER_COLORS.length]
}

function CareerCard({ career, colorClass }) {
  return (
    <div className="panel p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
      <Briefcase className={`w-5 h-5 shrink-0 ${colorClass}`} />
      <span className="font-display font-semibold text-white text-sm">{career.name}</span>
    </div>
  )
}

function RoleCard({ role }) {
  return (
    <div className="panel p-3 flex items-center gap-2.5 hover:bg-white/[0.02] transition-colors">
      <Target className="w-4 h-4 shrink-0 text-sc-accent" />
      <span className="text-sm text-gray-200 font-medium">{role.name}</span>
    </div>
  )
}

function LetterGroup({ letter, roles }) {
  return (
    <div>
      <h3 className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-2 pl-1">
        {letter}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
      </div>
    </div>
  )
}

export default function Careers() {
  const { data, loading, error, refetch } = useAPI('/gamedata/careers')
  const [search, setSearch] = useState('')

  const { filteredCareers, groupedRoles, hasResults } = useMemo(() => {
    if (!data) return { filteredCareers: [], groupedRoles: [], hasResults: false }

    const careers = data.careers || []
    const roles = data.roles || []
    const q = search.toLowerCase().trim()

    const matchedCareers = q
      ? careers.filter((c) => c.name.toLowerCase().includes(q))
      : careers

    const matchedRoles = q
      ? roles.filter((r) => r.name.toLowerCase().includes(q))
      : roles

    // Group roles by first letter
    const byLetter = {}
    for (const role of matchedRoles) {
      const letter = role.name.charAt(0).toUpperCase()
      if (!byLetter[letter]) byLetter[letter] = []
      byLetter[letter].push(role)
    }

    const sorted = Object.entries(byLetter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, letterRoles]) => ({ letter, roles: letterRoles }))

    return {
      filteredCareers: matchedCareers,
      groupedRoles: sorted,
      hasResults: matchedCareers.length > 0 || sorted.length > 0,
    }
  }, [data, search])

  const totalCareers = data?.careers?.length || 0
  const totalRoles = data?.roles?.length || 0

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Careers & Roles"
        subtitle={`${totalCareers} careers · ${totalRoles} roles`}
      />

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search careers and roles..."
        />
      </div>

      {!hasResults && (
        <div className="panel p-8 text-center">
          <p className="text-gray-500 text-sm">No careers or roles match your search.</p>
        </div>
      )}

      {/* Vehicle Careers */}
      {filteredCareers.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-sc-accent" />
            Vehicle Careers
            <span className="text-xs font-mono text-gray-500 ml-1">{filteredCareers.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {filteredCareers.map((career, i) => (
              <CareerCard key={career.id} career={career} colorClass={getCareerColor(i)} />
            ))}
          </div>
        </section>
      )}

      {/* Vehicle Roles */}
      {groupedRoles.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-sc-accent" />
            Vehicle Roles
            <span className="text-xs font-mono text-gray-500 ml-1">{totalRoles}</span>
          </h2>
          <div className="space-y-4">
            {groupedRoles.map(({ letter, roles }) => (
              <LetterGroup key={letter} letter={letter} roles={roles} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
