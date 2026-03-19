import React, { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { interpolateModifier, generateDistributionCurve } from './plannerHelpers'

const SPEED_STYLES = {
  'Very Fast': 'text-green-400',
  'Fast': 'text-green-400',
  'Normal': 'text-gray-400',
  'Slow': 'text-amber-400',
  'Very Slow': 'text-red-400',
}

const QUALITY_STYLES = {
  'Careful': 'text-green-400',
  'Normal': 'text-gray-400',
  'Rushed': 'text-amber-400',
  'Reckless': 'text-red-400',
}

function QualitySlider({ value, onChange, min = 0, max = 1000 }) {
  const pct = ((value - min) / (max - min)) * 100
  // Red at low, amber in middle, green at high
  const gradientColor = pct < 33 ? 'from-red-500 to-amber-500'
    : pct < 66 ? 'from-amber-500 to-emerald-500'
    : 'from-emerald-500 to-cyan-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-display uppercase tracking-wider text-gray-500">Quality Level</label>
        <span className="text-sm font-mono font-bold text-cyan-400">{value}</span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${gradientColor} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-600">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function StatImpactTable({ slot, quality }) {
  const modifiers = slot?.modifiers || []
  if (modifiers.length === 0) return null

  return (
    <div className="space-y-1">
      <h5 className="text-[10px] font-display uppercase tracking-wider text-gray-600">
        Modifier Impact at Q{quality}
      </h5>
      <div className="divide-y divide-gray-700/50">
        {modifiers.map((mod, i) => {
          const value = interpolateModifier(mod, quality)
          const isPositive = value > 0
          const pct = (value * 100).toFixed(1)
          return (
            <div key={i} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-gray-400">{mod.name}</span>
              <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const { quality, probability } = payload[0].payload
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
      <p className="font-mono text-gray-300">Quality: <span className="text-cyan-400">{quality}</span></p>
      <p className="font-mono text-gray-500">Probability: {(probability * 10000).toFixed(2)}</p>
    </div>
  )
}

export default function QualityImpact({
  location,
  qualityDistributions,
  refining,
  blueprint,
  selectedMaterial,
}) {
  const [quality, setQuality] = useState(500)

  // Find the quality distribution for this location's system
  const distribution = useMemo(() => {
    if (!location || !qualityDistributions?.length) return null
    // Try to match by location name/system
    const match = qualityDistributions.find(d =>
      location.name.toLowerCase().includes(d.name.toLowerCase()) ||
      location.system.toLowerCase().includes(d.name.toLowerCase())
    )
    return match || qualityDistributions[0] || null
  }, [location, qualityDistributions])

  // Generate distribution curve
  const curveData = useMemo(() => {
    if (!distribution) return []
    return generateDistributionCurve(
      distribution.mean,
      distribution.stddev,
      distribution.min_quality,
      distribution.max_quality,
    )
  }, [distribution])

  // Find the slot for the selected material
  const materialSlot = useMemo(() => {
    if (!blueprint || !selectedMaterial) return null
    return blueprint.slots?.find(s => s.resource_name === selectedMaterial) || null
  }, [blueprint, selectedMaterial])

  return (
    <div className="space-y-4">
      {/* Stage connector */}
      <div className="flex justify-center">
        <div className="w-px h-6 bg-gradient-to-b from-cyan-500/40 to-cyan-500/10" />
      </div>

      {/* Stage 4 header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-sm font-bold shrink-0">4</div>
        <div>
          <h3 className="font-display font-bold text-white tracking-wide text-sm uppercase">Quality Impact</h3>
          <p className="text-xs font-mono text-gray-500">
            Quality distribution at {location?.name || 'selected location'} &mdash; slide to preview stats
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Distribution chart + slider */}
        <div className="space-y-4">
          {curveData.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <h5 className="text-[10px] font-display uppercase tracking-wider text-gray-600 mb-3">
                Quality Distribution {distribution?.name && `(${distribution.name})`}
              </h5>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={curveData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="quality"
                    tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    x={quality}
                    stroke="#06b6d4"
                    strokeDasharray="3 3"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="probability"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#qualityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <QualitySlider
            value={quality}
            onChange={setQuality}
            min={distribution?.min_quality ?? 0}
            max={distribution?.max_quality ?? 1000}
          />
        </div>

        {/* Right: Stat impact + refining comparison */}
        <div className="space-y-4">
          {materialSlot && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <StatImpactTable slot={materialSlot} quality={quality} />
            </div>
          )}

          {/* Refining process comparison */}
          {refining?.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
              <h5 className="text-[10px] font-display uppercase tracking-wider text-gray-600 mb-2">
                Refining Processes
              </h5>
              <div className="divide-y divide-gray-700/50">
                {refining.map(proc => (
                  <div key={proc.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="text-gray-300 font-medium">{proc.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono ${SPEED_STYLES[proc.speed] || 'text-gray-400'}`}>
                        {proc.speed || '--'}
                      </span>
                      <span className={`font-mono ${QUALITY_STYLES[proc.quality] || 'text-gray-400'}`}>
                        {proc.quality || '--'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
