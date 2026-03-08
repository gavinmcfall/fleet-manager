import React, { useState, useMemo } from 'react'
import { useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'
import { Briefcase, ChevronDown, ChevronRight } from 'lucide-react'

function CareerCard({ career, roles, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-sc-accent shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        }
        <Briefcase className="w-5 h-5 text-sc-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-white text-sm">{career.name}</h3>
          {career.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{career.description}</p>
          )}
        </div>
        <span className="text-xs font-mono text-gray-500 shrink-0">
          {roles.length} {roles.length === 1 ? 'role' : 'roles'}
        </span>
      </button>

      {expanded && roles.length > 0 && (
        <div className="border-t border-white/5">
          {roles.map((role) => (
            <div
              key={role.id}
              className="px-4 py-3 pl-14 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
            >
              <p className="text-sm text-gray-200 font-medium">{role.name}</p>
              {role.description && (
                <p className="text-xs text-gray-500 mt-1">{role.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && roles.length === 0 && (
        <div className="border-t border-white/5 px-4 py-3 pl-14">
          <p className="text-xs text-gray-600 italic">No roles defined</p>
        </div>
      )}
    </div>
  )
}

export default function Careers() {
  const { data, loading, error, refetch } = useAPI('/gamedata/careers')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []

    const careers = data.careers || []
    const roles = data.roles || []
    const q = search.toLowerCase().trim()

    // Group roles by career_id
    const rolesByCareer = {}
    for (const role of roles) {
      if (!rolesByCareer[role.career_id]) rolesByCareer[role.career_id] = []
      rolesByCareer[role.career_id].push(role)
    }

    if (!q) {
      return careers.map((c) => ({
        career: c,
        roles: rolesByCareer[c.id] || [],
      }))
    }

    // Filter: include career if name/description matches, or if any role matches
    return careers
      .map((c) => {
        const careerMatch =
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))

        const careerRoles = rolesByCareer[c.id] || []
        const matchingRoles = careerRoles.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.description && r.description.toLowerCase().includes(q))
        )

        if (careerMatch) return { career: c, roles: careerRoles }
        if (matchingRoles.length > 0) return { career: c, roles: matchingRoles }
        return null
      })
      .filter(Boolean)
  }, [data, search])

  const totalCareers = data?.careers?.length || 0
  const totalRoles = data?.roles?.length || 0

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Careers & Roles"
        subtitle={`${totalCareers} careers · ${totalRoles} roles`}
      />

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search careers and roles…"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="panel p-8 text-center">
            <p className="text-gray-500 text-sm">No careers or roles match your search.</p>
          </div>
        )}

        {filtered.map(({ career, roles }) => (
          <CareerCard
            key={career.id}
            career={career}
            roles={roles}
            defaultExpanded={!search}
          />
        ))}
      </div>
    </div>
  )
}
