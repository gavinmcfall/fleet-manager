import {
  Crosshair, Swords, Shield, HardHat, Shirt, Puzzle, Pill, Gem, Box,
  Wrench, Package, Rocket, Cpu, Bomb, HelpCircle, Layers,
} from 'lucide-react'

const CATEGORY_ICONS = {
  weapon: Crosshair,
  melee: Swords,
  armour: Shield,
  helmet: HardHat,
  clothing: Shirt,
  attachment: Puzzle,
  consumable: Pill,
  harvestable: Gem,
  carryable: Package,
  prop: Box,
  utility: Wrench,
  ship_weapon: Rocket,
  ship_component: Cpu,
  missile: Bomb,
  unknown: HelpCircle,
}

const CATEGORY_LABELS = {
  weapon: 'Weapons',
  melee: 'Melee',
  armour: 'Armour',
  helmet: 'Helmets',
  clothing: 'Clothing',
  attachment: 'Attachments',
  consumable: 'Consumables',
  harvestable: 'Harvestables',
  carryable: 'Carryables',
  prop: 'Props',
  utility: 'Utility',
  ship_weapon: 'Ship Weapons',
  ship_component: 'Ship Components',
  missile: 'Missiles',
  unknown: 'Other',
}

export default function CategoryStrip({ categories, counts, active, onSelect }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
          active === 'all'
            ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
            : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-300'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>All</span>
        <span className="font-mono text-[10px] opacity-60">{Object.values(counts).reduce((s, c) => s + c, 0)}</span>
      </button>
      {categories.map(cat => {
        const Icon = CATEGORY_ICONS[cat] || HelpCircle
        const label = CATEGORY_LABELS[cat] || cat
        const count = counts[cat] || 0
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              active === cat
                ? 'bg-sc-accent/15 text-sc-accent border-sc-accent/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:border-white/[0.12] hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            <span className="font-mono text-[10px] opacity-60">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
