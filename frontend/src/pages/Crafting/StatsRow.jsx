import React, { useEffect, useRef, useState } from 'react'
import { Layers, Gem, Clock, TrendingUp } from 'lucide-react'

function AnimatedNumber({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (typeof value !== 'number' || value === 0) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const from = 0
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [value, duration])

  return <span>{display.toLocaleString()}</span>
}

function StatCard({ icon: Icon, label, value, suffix, delay = 0 }) {
  return (
    <div
      className="relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 animate-stagger-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sc-accent/10">
          <Icon className="w-4 h-4 text-sc-accent" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p
            className="text-2xl font-bold text-white"
            style={{ textShadow: '0 0 12px rgba(34, 211, 238, 0.3)' }}
          >
            <AnimatedNumber value={value} />
            {suffix && <span className="text-sm text-gray-400 ml-1">{suffix}</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function StatsRow({ blueprints, resources }) {
  const avgTime = blueprints.length > 0
    ? Math.round(blueprints.reduce((sum, b) => sum + (b.craft_time_seconds || 0), 0) / blueprints.length)
    : 0

  const typeCounts = {}
  blueprints.forEach(b => { typeCounts[b.type] = (typeCounts[b.type] || 0) + 1 })
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      <StatCard icon={Layers} label="Blueprints" value={blueprints.length} delay={0} />
      <StatCard icon={Gem} label="Resources" value={resources.length} delay={60} />
      <StatCard icon={Clock} label="Avg Craft Time" value={avgTime} suffix="s" delay={120} />
      <StatCard
        icon={TrendingUp}
        label="Top Type"
        value={topType ? topType[1] : 0}
        suffix={topType ? topType[0] : ''}
        delay={180}
      />
    </div>
  )
}
