import { useMemo } from 'react'

// Sub-filter config: which field to group by, and label mappings
const SUB_FILTER_CONFIG = {
  armour: {
    field: 'type',
    labels: {
      Char_Armor_Helmet: 'Helmets',
      Char_Armor_Torso: 'Core',
      Char_Armor_Arms: 'Arms',
      Char_Armor_Legs: 'Legs',
      Char_Armor_Backpack: 'Backpacks',
      Char_Armor_Undersuit: 'Undersuits',
    },
  },
  weapon: {
    field: 'sub_type',
    labels: {
      Small: 'Pistols',
      Medium: 'Rifles',
      Large: 'Heavy',
      Gadget: 'Gadgets',
    },
  },
  clothing: {
    field: 'type',
    labels: {
      Char_Clothing_Hat: 'Hats',
      Char_Clothing_Torso_0: 'Shirts',
      Char_Clothing_Torso_1: 'Jackets',
      Char_Clothing_Legs: 'Pants',
      Char_Clothing_Feet: 'Boots',
      Char_Clothing_Hands: 'Gloves',
      Char_Accessory_Eyes: 'Eyewear',
      Char_Clothing_Backpack: 'Backpacks',
    },
  },
  attachment: {
    field: 'sub_type',
    labels: {
      IronSight: 'Sights',
      Barrel: 'Barrels',
      BottomAttachment: 'Underbarrel',
      Utility: 'Utility',
      Magazine: 'Magazines',
    },
  },
  ship_component: {
    field: 'type',
    labels: {
      PowerPlant: 'Power Plants',
      Cooler: 'Coolers',
      Shield: 'Shields',
      QuantumDrive: 'Quantum Drives',
      Radar: 'Radar',
      MiningModifier: 'Mining Lasers',
      TractorBeam: 'Tractor Beams',
    },
  },
  consumable: {
    field: 'type',
    labels: {
      Food: 'Food',
      Drink: 'Drinks',
      FPS_Consumable: 'Medical',
    },
  },
}

export default function SubFilterStrip({ category, items, active, onSelect }) {
  const config = SUB_FILTER_CONFIG[category]

  const subCounts = useMemo(() => {
    if (!config || !items) return []
    const field = config.field
    const counts = {}
    for (const item of items) {
      const val = item[field]
      if (!val || val === 'UNDEFINED') continue
      // Only count values we have labels for (skip noise)
      if (config.labels[val]) {
        counts[val] = (counts[val] || 0) + 1
      }
    }
    // Sort by the order defined in labels config
    return Object.keys(config.labels)
      .filter(k => counts[k] > 0)
      .map(k => ({ value: k, label: config.labels[k], count: counts[k] }))
  }, [config, items])

  if (!config || subCounts.length < 2) return null

  return (
    <div className="flex flex-wrap gap-1">
      <button
        onClick={() => onSelect(null)}
        className={`px-2 py-1 rounded text-[10px] font-medium transition-all duration-200 border whitespace-nowrap ${
          !active
            ? 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
            : 'bg-white/[0.02] text-gray-500 border-white/[0.05] hover:border-white/[0.1] hover:text-gray-400'
        }`}
      >
        All
      </button>
      {subCounts.map(({ value, label, count }) => (
        <button
          key={value}
          onClick={() => onSelect(active === value ? null : value)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-all duration-200 border whitespace-nowrap ${
            active === value
              ? 'bg-sc-accent/10 text-sc-accent border-sc-accent/25'
              : 'bg-white/[0.02] text-gray-500 border-white/[0.05] hover:border-white/[0.1] hover:text-gray-400'
          }`}
        >
          {label} <span className="font-mono opacity-60">{count}</span>
        </button>
      ))}
    </div>
  )
}

export { SUB_FILTER_CONFIG }
