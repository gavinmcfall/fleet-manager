import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Rocket, BarChart3, Shield, Upload, RefreshCw, Database } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import FleetTable from './pages/FleetTable'
import Insurance from './pages/Insurance'
import Analysis from './pages/Analysis'
import Import from './pages/Import'
import ShipDB from './pages/ShipDB'

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/fleet', icon: Rocket, label: 'Fleet' },
  { to: '/insurance', icon: Shield, label: 'Insurance' },
  { to: '/analysis', icon: RefreshCw, label: 'Analysis' },
  { to: '/ships', icon: Database, label: 'Ship DB' },
  { to: '/import', icon: Upload, label: 'Import' },
]

export default function App() {
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
          {navItems.map(({ to, icon: Icon, label }) => (
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
          ))}
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<FleetTable />} />
            <Route path="/insurance" element={<Insurance />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/ships" element={<ShipDB />} />
            <Route path="/import" element={<Import />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
