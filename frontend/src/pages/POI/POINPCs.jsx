import React from 'react'

/**
 * NPC factions that spawn here. Currently a stub because the extraction
 * pipeline doesn't yet emit POI-keyed spawn data — the `spawn_locations`
 * column in loot_item_locations is descriptive text ("Wildlife (biome spawn)",
 * "Mission: Outpost - A S D"), not queryable by POI slug. Section renders
 * with the envelope's note so players know we're aware it's incomplete.
 */
export default function POINPCs({ envelope }) {
  if (envelope.count === 0 && !envelope.note) return null
  return (
    <section>
      <h2 className="text-sm font-display uppercase tracking-widest text-gray-400 mb-3">
        NPC factions here
      </h2>
      {envelope.count > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {envelope.data.map(faction => (
            <div key={faction.id} className="flex items-center gap-2 px-3 py-2 border border-sc-border rounded">
              <span className="text-xs text-gray-200 flex-1">{faction.name}</span>
              <span className="text-[10px] text-gray-500 font-mono">{faction.loadout_count} loadouts</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">{envelope.note}</p>
      )}
    </section>
  )
}
