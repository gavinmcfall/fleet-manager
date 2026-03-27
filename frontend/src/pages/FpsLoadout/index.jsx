import React, { useState } from 'react'

const ICON = (name) => `/inventory-assets/${name}`

// CSS filter to tint dark SVG icons → cyan (matches in-game)
const ICO_FILTER = 'invert(0.85) sepia(1) saturate(4) hue-rotate(155deg) brightness(1.05)'

function Ico({ src, size = '1.2vw', dim = false, className = '' }) {
  return (
    <img
      src={ICON(src)}
      alt=""
      className={className}
      style={{
        width: size, height: size,
        filter: ICO_FILTER,
        opacity: dim ? 0.4 : 0.7,
      }}
    />
  )
}

function HazardSep({ thin = false, label = null }) {
  const h = thin ? 'h-2' : 'h-3'
  const opacity = thin ? '0.06' : '0.1'
  return (
    <div className={`flex items-center ${h} my-0.5`}>
      <div className="flex-1 h-full" style={{ background: `repeating-linear-gradient(135deg,rgba(192,246,254,${opacity}) 0px,rgba(192,246,254,${opacity}) 4px,transparent 4px,transparent 8px)` }} />
      {label ? (
        <>
          <div className="w-0.5 h-full flex-shrink-0" style={{ background: 'rgba(192,246,254,0.5)' }} />
          <span className="px-3 flex-shrink-0 text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(192,246,254,0.7)' }}>{label}</span>
          <div className="w-0.5 h-full flex-shrink-0" style={{ background: 'rgba(192,246,254,0.5)' }} />
        </>
      ) : null}
      <div className="flex-1 h-full" style={{ background: `repeating-linear-gradient(45deg,rgba(192,246,254,${opacity}) 0px,rgba(192,246,254,${opacity}) 4px,transparent 4px,transparent 8px)` }} />
    </div>
  )
}

function EquipSlot({ icon, size = '2.4vw', badge = null, children }) {
  return (
    <div
      className="flex items-center justify-center cursor-pointer relative"
      style={{
        height: '5.93vh',
        background: 'rgba(0,18,28,0.6)',
        border: '1px solid rgba(0,200,230,0.15)',
        borderRadius: 4,
      }}
    >
      <Ico src={icon} size={size} dim />
      {badge && (
        <span
          className="absolute flex items-center justify-center font-mono"
          style={{
            bottom: '0.4vh', right: '0.4vw',
            width: '1.1vw', height: '1.1vw',
            borderRadius: '50%',
            border: '1px solid rgba(192,246,254,0.3)',
            background: 'rgba(0,6,15,0.6)',
            fontSize: '0.75vw',
            color: 'rgba(192,246,254,0.6)',
          }}
        >{badge}</span>
      )}
      {children}
    </div>
  )
}

function PaperdollSlot({ icon, style, small = false }) {
  const cls = small ? 'w-[4vmin] h-[4vmin]' : 'w-[5.5vmin] h-[5.5vmin]'
  return (
    <div
      className={`${cls} flex items-center justify-center cursor-pointer rounded-full`}
      style={{
        background: `url(${ICON('inventory_paperdoll_item_bg.png')}) center / 100% 100% no-repeat`,
        position: small ? 'static' : 'absolute',
        ...style,
      }}
    >
      <Ico src={icon} size={small ? '1.6vmin' : '2.5vmin'} />
    </div>
  )
}

function EquipmentPanel({ equipTab, setEquipTab }) {
  return (
    <div className="flex flex-col h-full">
      {/* Equipped gear list (placeholder for now) */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0.93vh 0.73vw' }}>
        <div className="text-[0.72vw] tracking-[0.16vw] uppercase mb-1">
          PERSONAL<span className="mx-1" style={{ color: 'rgba(192,246,254,0.3)' }}>/</span><span style={{ color: '#00e8ff' }}>ALL</span>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: '20vh', color: 'rgba(192,246,254,0.25)', fontSize: '0.57vw', letterSpacing: '0.16vw', textTransform: 'uppercase' }}>
          DRAG GEAR TO EQUIP
        </div>
      </div>

      {/* Bottom equipment slots */}
      <div className="flex flex-shrink-0" style={{ padding: '0 0.73vw 0.93vh' }}>
        {/* Tab buttons */}
        <div className="flex flex-col gap-0.5 flex-shrink-0" style={{ width: '3vw' }}>
          <button
            onClick={() => setEquipTab('weapons')}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: '2.7vw', height: '3.9vh',
              border: `1px solid rgba(0,232,255,${equipTab === 'weapons' ? 0.3 : 0.1})`,
              background: equipTab === 'weapons' ? 'rgba(0,232,255,0.08)' : 'transparent',
            }}
          >
            <Ico src="icon_common_sidearm.svg" dim={equipTab !== 'weapons'} />
          </button>
          <button
            onClick={() => setEquipTab('gadgets')}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: '2.7vw', height: '3.9vh',
              border: `1px solid rgba(0,232,255,${equipTab === 'gadgets' ? 0.3 : 0.1})`,
              background: equipTab === 'gadgets' ? 'rgba(0,232,255,0.08)' : 'transparent',
            }}
          >
            <Ico src="icon_common_utility.svg" dim={equipTab !== 'gadgets'} />
          </button>
        </div>

        {/* Slot grids */}
        <div className="flex-1 flex flex-col">
          <HazardSep label="EQUIPMENT" />

          {equipTab === 'weapons' ? (
            <>
              <EquipSlot icon="icon_inventory_handheld.svg" />
              <HazardSep />
              {/* Primary weapon + attachments */}
              <div className="flex gap-[0.16vw] my-[0.19vh]" style={{ height: '5.93vh' }}>
                <div className="flex-[2]"><EquipSlot icon="icon_common_primary_weapon.svg" badge="1" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_scope.svg" size="1.8vw" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_barrel.svg" size="1.8vw" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_underbarrel.svg" size="1.8vw" /></div>
              </div>
              <HazardSep thin />
              {/* Secondary weapon + attachments */}
              <div className="flex gap-[0.16vw] my-[0.19vh]" style={{ height: '5.93vh' }}>
                <div className="flex-[2]"><EquipSlot icon="icon_common_secondary_weapon.svg" badge="2" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_scope.svg" size="1.8vw" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_barrel.svg" size="1.8vw" /></div>
                <div className="flex-1"><EquipSlot icon="icon_common_weapon_attachment_underbarrel.svg" size="1.8vw" /></div>
              </div>
              <HazardSep thin />
              <EquipSlot icon="icon_common_sidearm.svg" badge="3" />
            </>
          ) : (
            <>
              <EquipSlot icon="icon_inventory_handheld.svg" />
              <HazardSep />
              <EquipSlot icon="icon_common_gadgets.svg" badge="4" />
              <HazardSep thin />
              <EquipSlot icon="icon_common_knife.svg" />
              <HazardSep thin />
              <EquipSlot icon="icon_common_miningGadget.svg" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Paperdoll() {
  return (
    <div className="relative w-full h-full">
      {/* Right column — armor/clothing slots */}
      <PaperdollSlot icon="icon_common_helmet.svg" style={{ top: '7%', right: '10%' }} />
      <PaperdollSlot icon="icon_common_glasses.svg" style={{ top: '18%', right: '10%' }} />
      <PaperdollSlot icon="PIT_Looting_Core_Icon.svg" style={{ top: '33%', right: '10%' }} />
      <PaperdollSlot icon="icon_common_arms.svg" style={{ top: '48%', right: '10%' }} />
      <PaperdollSlot icon="PIT_Looting_Legs_Icon.svg" style={{ top: '63%', right: '10%' }} />
      <PaperdollSlot icon="icon_common_shoe.svg" style={{ top: '78%', right: '10%' }} />

      {/* Left — Throwables row */}
      <div className="absolute flex gap-[0.3vw]" style={{ top: '12%', left: '8%' }}>
        {[0,1,2,3].map(i => <PaperdollSlot key={i} icon="icon_common_grenade.svg" small />)}
      </div>

      {/* Left — Backpack */}
      <PaperdollSlot icon="PIT_Looting_Backpack_Icon.svg" style={{ top: '24%', left: '8%' }} />

      {/* Left — Magazines (2 rows of 4) */}
      <div className="absolute flex gap-[0.3vw]" style={{ top: '44%', left: '6%' }}>
        {[0,1,2,3].map(i => <PaperdollSlot key={i} icon="icon_common_magazine.svg" small />)}
      </div>
      <div className="absolute flex gap-[0.3vw]" style={{ top: '50%', left: '6%' }}>
        {[0,1,2,3].map(i => <PaperdollSlot key={i} icon="icon_common_magazine.svg" small />)}
      </div>

      {/* Left — Consumables (1 row of 4) */}
      <div className="absolute flex gap-[0.3vw]" style={{ top: '66%', left: '6%' }}>
        {[0,1,2,3].map(i => <PaperdollSlot key={i} icon="icon_common_consumable.svg" small />)}
      </div>

      {/* Center label */}
      <div className="absolute left-1/2 top-[3%] -translate-x-1/2 text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(192,246,254,0.3)' }}>
        LOADOUT
      </div>
    </div>
  )
}

function GearBrowser() {
  return (
    <div className="flex flex-col h-full" style={{ padding: '0.93vh 0.73vw' }}>
      <div className="text-[0.72vw] tracking-[0.16vw] uppercase mb-1">
        GEAR<span className="mx-1" style={{ color: 'rgba(192,246,254,0.3)' }}>/</span><span style={{ color: '#00e8ff' }}>BROWSE</span>
      </div>

      {/* Search bar placeholder */}
      <div className="flex items-center gap-1 mb-1">
        <Ico src="icon_common_menu_search.svg" size="0.94vw" />
        <div
          className="flex-1 flex items-center px-2"
          style={{
            height: '2.2vh',
            border: '1px solid rgba(0,232,255,0.15)',
            background: 'rgba(0,12,20,0.4)',
          }}
        >
          <span style={{ fontSize: '0.47vw', color: 'rgba(192,246,254,0.25)', letterSpacing: '0.08vw', textTransform: 'uppercase' }}>SEARCH...</span>
        </div>
      </div>

      {/* Filter row placeholder */}
      <div className="flex items-center gap-[0.1vw] my-[0.37vh]">
        {['icon_common_active_group.svg', 'icon_common_primary_weapon.svg', 'PIT_Looting_Core_Icon.svg', 'icon_common_under_suit.svg', 'icon_common_helmet.svg', 'icon_common_gadgets.svg'].map((icon, i) => (
          <div
            key={icon}
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: '1.46vw', height: '2.4vh',
              border: `1px solid ${i === 0 ? '#00e8ff' : 'transparent'}`,
              background: i === 0 ? 'rgba(0,232,255,0.07)' : 'transparent',
            }}
          >
            <Ico src={icon} size="0.9vw" dim={i !== 0} />
          </div>
        ))}
      </div>

      {/* Gear list placeholder */}
      <div className="flex-1 overflow-y-auto" style={{ color: 'rgba(192,246,254,0.25)', fontSize: '0.57vw', letterSpacing: '0.16vw', textTransform: 'uppercase' }}>
        <div className="flex items-center justify-center h-full">
          GEAR LIST
        </div>
      </div>
    </div>
  )
}

export default function FpsLoadout() {
  const [equipTab, setEquipTab] = useState('weapons')

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: 'calc(100vh - 3rem)',
        background: '#000306',
        color: '#c0f6fe',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Inner wrapper with perspective for 3D panel effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: '95%', height: '95%', perspective: '2200px' }}>

          {/* Panel frame backgrounds */}
          <div
            className="absolute top-0 left-0 h-full pointer-events-none"
            style={{
              width: '50%',
              transformStyle: 'preserve-3d',
              transformOrigin: '0% 50%',
              transform: 'rotateY(5deg)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                width: '65%',
                background: `url(${ICON('inventory_panel_composite.png')}) left top / 100% 100% no-repeat`,
              }}
            />
          </div>
          <div
            className="absolute top-0 right-0 h-full pointer-events-none"
            style={{
              width: '50%',
              transformStyle: 'preserve-3d',
              transformOrigin: '100% 50%',
              transform: 'rotateY(-5deg)',
            }}
          >
            <div
              className="absolute inset-0 right-0 ml-auto"
              style={{
                width: '65%',
                background: `url(${ICON('inventory_panel_composite.png')}) left top / 100% 100% no-repeat`,
                transform: 'scaleX(-1)',
              }}
            />
          </div>

          {/* Separators */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: '26.46%', top: '50%', transform: 'translateY(-50%)',
              width: '3.333%', height: '68.519%',
              background: `url(${ICON('inventory_bg_separator.png')}) center / 100% 100% no-repeat`,
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              right: '26.46%', top: '50%', transform: 'translateY(-50%) scaleX(-1)',
              width: '3.333%', height: '68.519%',
              background: `url(${ICON('inventory_bg_separator.png')}) center / 100% 100% no-repeat`,
            }}
          />

          {/* Left panel — Equipment */}
          <div
            className="absolute left-0 flex flex-col z-10"
            style={{ top: '6.25%', width: '26.5625%', height: '87.5%' }}
          >
            <EquipmentPanel equipTab={equipTab} setEquipTab={setEquipTab} />
          </div>

          {/* Center — Paperdoll */}
          <div
            className="absolute z-[5]"
            style={{ left: '26.5625%', right: '26.5625%', top: 0, height: '100%' }}
          >
            <Paperdoll />
          </div>

          {/* Right panel — Gear Browser */}
          <div
            className="absolute right-0 flex flex-col z-10"
            style={{ top: '6.25%', width: '26.5625%', height: '87.5%' }}
          >
            <GearBrowser />
          </div>

        </div>
      </div>
    </div>
  )
}
