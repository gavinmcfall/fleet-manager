import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, ChevronDown, ChevronUp, Package, MapPin, Users, Crosshair } from 'lucide-react'
import { useContracts, useAPI } from '../hooks/useAPI'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import SearchInput from '../components/SearchInput'

// ── Contract constants ──────────────────────────────────────────────────────

const GIVER_TABS = [
  { key: 'all',    label: 'All' },
  { key: 'wikelo', label: 'Wikelo' },
  { key: 'gfs',    label: "Gilly's Flight School" },
  { key: 'ruto',   label: 'Ruto' },
]

const GIVER_BADGE = {
  wikelo: 'bg-purple-900/50 text-purple-300 border border-purple-700/50',
  gfs:    'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  ruto:   'bg-orange-900/50 text-orange-300 border border-orange-700/50',
}

const CATEGORY_BADGE = {
  'Small Items':         'bg-green-900/40 text-green-300',
  'Standard':            'bg-gray-700/60 text-gray-300',
  'Favours':             'bg-yellow-900/40 text-yellow-300',
  'Vehicle Delivery':    'bg-indigo-900/40 text-indigo-300',
  'Combat Gauntlet':     'bg-blue-900/40 text-blue-300',
  'Navy Patrol Training':'bg-sky-900/40 text-sky-300',
  'Waste Disposal':      'bg-amber-900/40 text-amber-300',
  'Synced Assassination':'bg-red-900/40 text-red-300',
}

const MISSION_TYPE_BADGE = {
  'Bounty Hunter':    'bg-red-900/40 text-red-300',
  'Mercenary':        'bg-red-900/40 text-red-200',
  'Delivery':         'bg-indigo-900/40 text-indigo-300',
  'Hauling':          'bg-amber-900/40 text-amber-300',
  'Mining':           'bg-yellow-900/40 text-yellow-300',
  'Ship Mining':      'bg-yellow-900/40 text-yellow-200',
  'Hand Mining':      'bg-yellow-900/40 text-yellow-200',
  'Salvage':          'bg-teal-900/40 text-teal-300',
  'Racing':           'bg-cyan-900/40 text-cyan-300',
  'Rescue':           'bg-green-900/40 text-green-300',
  'Investigation':    'bg-purple-900/40 text-purple-300',
  'Research':         'bg-violet-900/40 text-violet-300',
  'ECN Alert':        'bg-orange-900/40 text-orange-300',
  'PvP Missions':     'bg-rose-900/40 text-rose-300',
  'Service Beacons':  'bg-sky-900/40 text-sky-300',
}

function cleanDesc(text) {
  if (!text) return ''
  return text.replace(/<[^>]+>/g, '').trim()
}

function parseRequirements(contract) {
  if (!contract.requirements_json) return null
  try {
    const reqs = JSON.parse(contract.requirements_json)
    return reqs.length > 0 ? reqs : null
  } catch { return null }
}

const GUILD_TO_GIVER = {
  thecollector: 'wikelo',
  hockrowagency_facilitydelve: 'gfs',
}

// ── Contract card ───────────────────────────────────────────────────────────

function ContractCard({ contract, highlighted }) {
  const cardRef = useRef(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])
  const desc = cleanDesc(contract.description)
  const isLong = desc.length > 200
  const requirements = parseRequirements(contract)

  return (
    <div
      ref={cardRef}
      id={`contract-${contract.id}`}
      className={`panel p-4 space-y-3 transition-all duration-700 ${highlighted ? 'ring-2 ring-sc-accent/60 bg-sc-accent/5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-white text-sm leading-tight flex-1 min-w-0">
          {contract.title}
        </h3>
        <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${GIVER_BADGE[contract.giver_slug] || 'bg-gray-700 text-gray-300'}`}>
          {contract.giver_slug === 'wikelo' ? 'Wikelo' : contract.giver_slug === 'gfs' ? 'GFS' : 'Ruto'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${CATEGORY_BADGE[contract.category] || 'bg-gray-700/60 text-gray-400'}`}>
          {contract.category}
        </span>
        {contract.sequence_num != null && (
          <span className="text-[10px] font-mono text-gray-500">
            #{contract.sequence_num}{contract.category === 'Combat Gauntlet' ? ' of 8' : contract.category === 'Navy Patrol Training' ? ' of 3' : ''}
          </span>
        )}
      </div>

      {contract.reward_text && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Reward</span>
          {contract.reward_vehicle_slug ? (
            <Link to={`/ships/${contract.reward_vehicle_slug}`} className="text-xs font-mono text-sc-accent2 hover:text-sc-accent transition-colors underline underline-offset-2 decoration-sc-accent2/30 hover:decoration-sc-accent/60">
              {contract.reward_text}
            </Link>
          ) : contract.reward_item_uuid ? (
            <Link to={`/loot/${contract.reward_item_uuid}`} className="text-xs font-mono text-sc-accent2 hover:text-sc-accent transition-colors underline underline-offset-2 decoration-sc-accent2/30 hover:decoration-sc-accent/60">
              {contract.reward_text}
            </Link>
          ) : contract.reward_set_slug ? (
            <Link to={`/loot/sets/${contract.reward_set_slug}`} className="text-xs font-mono text-sc-accent2 hover:text-sc-accent transition-colors underline underline-offset-2 decoration-sc-accent2/30 hover:decoration-sc-accent/60">
              {contract.reward_text}
            </Link>
          ) : (
            <span className={`text-xs font-mono ${contract.reward_currency === 'aUEC' ? 'text-sc-melt' : contract.reward_currency === 'MG Scrip' ? 'text-blue-300' : 'text-sc-accent2'}`}>
              {contract.reward_text}
            </span>
          )}
        </div>
      )}

      {requirements && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Package className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Requirements</span>
          </div>
          <ul className="space-y-0.5 pl-1">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-mono text-gray-300">
                <span className="text-sc-accent2 min-w-[2ch] text-right">{req.quantity}x</span>
                <span>{req.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {contract.requirements_json === 'random' && (
        <div className="flex items-center gap-1.5">
          <Package className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] font-display uppercase tracking-wider text-gray-500">Requirements</span>
          <span className="text-xs font-mono text-gray-400 italic">Randomized each time</span>
        </div>
      )}

      {desc && (
        <div className="text-xs text-gray-400 leading-relaxed">
          <p className="whitespace-pre-line">
            {isLong && !expanded ? desc.slice(0, 200) + '…' : desc}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 flex items-center gap-1 text-[10px] font-display uppercase tracking-wide text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {contract.notes && (
        <p className="text-[10px] font-mono text-amber-400 italic">{contract.notes}</p>
      )}
    </div>
  )
}

// ── Mission type card ───────────────────────────────────────────────────────

function MissionTypeCard({ type }) {
  const desc = cleanDesc(type.description)
  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight flex-1 min-w-0">
          {type.name}
        </h3>
        <span className={`text-[10px] font-display uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${MISSION_TYPE_BADGE[type.name] || 'bg-gray-700/60 text-gray-400'}`}>
          {type.name}
        </span>
      </div>
      {desc && (
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{desc}</p>
      )}
    </div>
  )
}

// ── Mission giver card ──────────────────────────────────────────────────────

function MissionGiverCard({ giver }) {
  const desc = cleanDesc(giver.description)
  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-white text-sm leading-tight flex-1 min-w-0">
          {giver.name}
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {giver.faction_name && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sc-accent/15 text-sc-accent border border-sc-accent/30">
            <Users className="w-2.5 h-2.5" />
            {giver.faction_name}
          </span>
        )}
        {giver.location_name && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-500">
            <MapPin className="w-2.5 h-2.5" />
            {giver.location_name}
          </span>
        )}
      </div>
      {desc && (
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{desc}</p>
      )}
    </div>
  )
}

// ── Contracts tab ───────────────────────────────────────────────────────────

function ContractsTab() {
  const { data: contracts, loading, error, refetch } = useContracts()
  const VALID_GIVERS = GIVER_TABS.map(t => t.key)
  const [searchParams, setSearchParams] = useSearchParams()
  const guildParam = searchParams.get('guild')
  const highlightParam = searchParams.get('highlight')
  const giverParam = searchParams.get('giver') || (guildParam ? (GUILD_TO_GIVER[guildParam] || 'all') : 'all')
  const giverTab = VALID_GIVERS.includes(giverParam) ? giverParam : 'all'
  const setGiverTab = useCallback((t) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('guild')
      if (t === 'all') next.delete('giver')
      else next.set('giver', t)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const [search, setSearch] = useState('')
  const [highlightId, setHighlightId] = useState(highlightParam ? Number(highlightParam) : null)
  const [showAll, setShowAll] = useState(false)
  const INITIAL_COUNT = 30

  useEffect(() => {
    if (highlightId) {
      const t = setTimeout(() => setHighlightId(null), 4000)
      return () => clearTimeout(t)
    }
  }, [highlightId])

  const filtered = useMemo(() => {
    if (!contracts) return []
    let items = contracts
    if (giverTab !== 'all') items = items.filter((c) => c.giver_slug === giverTab)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.description && cleanDesc(c.description).toLowerCase().includes(q)) ||
        (c.requirements_json && c.requirements_json.toLowerCase().includes(q))
      )
    }
    return items
  }, [contracts, giverTab, search])

  useEffect(() => { setShowAll(false) }, [giverTab, search])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_COUNT)
  const hasMore = !showAll && filtered.length > INITIAL_COUNT

  if (loading) return <div className="py-8 text-center text-gray-500 font-mono text-sm">Loading contracts...</div>
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {GIVER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setGiverTab(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
              giverTab === tab.key
                ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
                : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search contracts..." className="max-w-md" />

      <span className="text-xs font-mono text-gray-500">{filtered.length} contracts</span>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((contract) => (
          <ContractCard key={contract.id} contract={contract} highlighted={contract.id === highlightId} />
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-2">
          <button onClick={() => setShowAll(true)} className="btn-secondary text-xs px-6">
            Show all ({filtered.length - INITIAL_COUNT} more)
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">No contracts found.</div>
      )}
    </div>
  )
}

// ── Missions tab ────────────────────────────────────────────────────────────

function MissionsTab() {
  const { data: missions, loading, error, refetch } = useAPI('/gamedata/missions')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('types')

  const types = missions?.types || []
  const givers = missions?.givers || []

  const filteredTypes = useMemo(() => {
    if (!search) return types.filter(t => t.name !== '<= UNINITIALIZED =>' && t.name !== '<= PLACEHOLDER =>')
    const q = search.toLowerCase()
    return types.filter(t =>
      t.name !== '<= UNINITIALIZED =>' && t.name !== '<= PLACEHOLDER =>' &&
      (t.name.toLowerCase().includes(q) || (t.description && cleanDesc(t.description).toLowerCase().includes(q)))
    )
  }, [types, search])

  const filteredGivers = useMemo(() => {
    if (!search) return givers
    const q = search.toLowerCase()
    return givers.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.faction_name && g.faction_name.toLowerCase().includes(q)) ||
      (g.location_name && g.location_name.toLowerCase().includes(q)) ||
      (g.description && cleanDesc(g.description).toLowerCase().includes(q))
    )
  }, [givers, search])

  if (loading) return <div className="py-8 text-center text-gray-500 font-mono text-sm">Loading missions...</div>
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const currentList = view === 'types' ? filteredTypes : filteredGivers

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setView('types')}
          className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
            view === 'types'
              ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
              : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
          }`}
        >
          <span className="flex items-center gap-1.5"><Crosshair className="w-3 h-3" /> Types ({filteredTypes.length})</span>
        </button>
        <button
          onClick={() => setView('givers')}
          className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wide transition-all duration-150 ${
            view === 'givers'
              ? 'bg-sc-accent/20 text-sc-accent border border-sc-accent/40'
              : 'text-gray-400 hover:text-gray-300 border border-sc-border hover:border-gray-600'
          }`}
        >
          <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Givers ({filteredGivers.length})</span>
        </button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={view === 'types' ? 'Search mission types...' : 'Search mission givers...'}
        className="max-w-md"
      />

      <span className="text-xs font-mono text-gray-500">{currentList.length} {view === 'types' ? 'mission types' : 'mission givers'}</span>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {view === 'types'
          ? filteredTypes.map(t => <MissionTypeCard key={t.id} type={t} />)
          : filteredGivers.map(g => <MissionGiverCard key={g.id} giver={g} />)
        }
      </div>

      {currentList.length === 0 && (
        <div className="text-center py-12 text-gray-500 font-mono text-sm">No {view === 'types' ? 'mission types' : 'mission givers'} found.</div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

const MAIN_TABS = [
  { key: 'contracts', label: 'Contracts', icon: FileText },
  { key: 'missions',  label: 'Mission Board', icon: Crosshair },
]

export default function Contracts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'missions' ? 'missions' : 'contracts'
  const setActiveTab = useCallback((tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (tab === 'contracts') next.delete('tab')
      else next.set('tab', tab)
      return next
    }, { replace: true })
  }, [setSearchParams])

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader
        title="MISSIONS & CONTRACTS"
        subtitle="Mission types, givers, and named NPC contract chains"
        actions={<FileText className="w-5 h-5 text-gray-500" />}
      />

      <div className="flex gap-0 border-b border-sc-border">
        {MAIN_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wide border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === key
                ? 'border-sc-accent text-sc-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'contracts' && <ContractsTab />}
      {activeTab === 'missions' && <MissionsTab />}
    </div>
  )
}
