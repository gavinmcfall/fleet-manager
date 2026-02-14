import React, { useState, Suspense, lazy } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Rocket, BarChart3, Shield, Upload, RefreshCw, Database, Settings as SettingsIcon, ChevronDown, ChevronRight, History } from 'lucide-react'

// Eager load Dashboard (initial route)
import Dashboard from './pages/Dashboard'

// Lazy load other routes
const FleetTable = lazy(() => import('./pages/FleetTable'))
const Insurance = lazy(() => import('./pages/Insurance'))
const Analysis = lazy(() => import('./pages/Analysis'))
const AnalysisHistory = lazy(() => import('./pages/AnalysisHistory'))
const Import = lazy(() => import('./pages/Import'))
const ShipDB = lazy(() => import('./pages/ShipDB'))
const Settings = lazy(() => import('./pages/Settings'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-sc-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-mono text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/fleet', icon: Rocket, label: 'Fleet' },
  { to: '/insurance', icon: Shield, label: 'Insurance' },
  {
    to: '/analysis',
    icon: RefreshCw,
    label: 'Analysis',
    submenu: [
      { to: '/analysis', icon: RefreshCw, label: 'Current' },
      { to: '/analysis/history', icon: History, label: 'History' },
    ],
  },
  { to: '/ships', icon: Database, label: 'Ship DB' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
]

export default function App() {
  const location = useLocation()
  const [expandedMenu, setExpandedMenu] = useState('/analysis') // Default expanded

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-56 bg-sc-darker/80 border-r border-sc-border flex flex-col shrink-0">
        <div className="p-5 border-b border-sc-border">
          <h1 className="font-display font-bold text-lg tracking-wider text-sc-accent flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            FLEET MGR
          </h1>
          <p className="text-[10px] font-mono text-gray-600 mt-1 tracking-widest">STAR CITIZEN</p>
        </div>
        <div className="flex flex-col gap-0.5 p-2 flex-1">
          {navItems.map((item) => {
            const { to, icon: Icon, label, submenu } = item
            const hasSubmenu = submenu && submenu.length > 0
            const isParentActive = location.pathname.startsWith(to)
            const isExpanded = expandedMenu === to

            if (hasSubmenu) {
              return (
                <div key={to}>
                  <button
                    onClick={() => setExpandedMenu(isExpanded ? null : to)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all duration-150 ${
                      isParentActive
                        ? 'bg-sc-accent/10 text-sc-accent border border-sc-accent/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-display tracking-wide text-xs uppercase flex-1 text-left">{label}</span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-sc-border pl-2">
                      {submenu.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          end
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-all duration-150 ${
                              isActive
                                ? 'bg-sc-accent/10 text-sc-accent'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`
                          }
                        >
                          <sub.icon className="w-3.5 h-3.5" />
                          <span className="font-display tracking-wide uppercase">{sub.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-sc-accent/10 text-sc-accent border border-sc-accent/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span className="font-display tracking-wide text-xs uppercase">{label}</span>
              </NavLink>
            )
          })}
        </div>
        <div className="p-3 border-t border-sc-border">
          <p className="text-[9px] font-mono text-gray-700 text-center tracking-widest">
            v1.0.0 · NZVengeance
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fleet" element={<FleetTable />} />
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/analysis/history" element={<AnalysisHistory />} />
              <Route path="/ships" element={<ShipDB />} />
              <Route path="/import" element={<Import />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}
