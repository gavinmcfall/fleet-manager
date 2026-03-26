import React from 'react'
import WeaponBlock from './WeaponBlock'

/**
 * TurretHeader — renders a turret housing as a section header with its weapon children.
 *
 * Props:
 *   item - the turret port data
 *   children - child weapon ports under this turret
 *   overrides - user customization overrides map
 *   onOpenPicker - handler for opening component picker
 *   onAddToCart - handler for cart button
 */
export default function TurretHeader({ item, children, overrides = {}, onOpenPicker, onAddToCart }) {
  // Use mount_name for turret label; if no mount, fall back to humanized port_name (not child weapon name)
  const turretLabel = item.mount_name || item.port_name?.replace('hardpoint_', '').replace(/_/g, ' ')
  // Friendly position from port name (only when mount has a proper name)
  const posHint = item.mount_name ? item.port_name?.replace('hardpoint_turret_', '').replace(/_/g, ' ') : null

  const override = overrides[item.port_id]
  const isOverridden = !!override

  return (
    <div>
      <div className="px-3 py-1 text-[12px] text-gray-600 bg-white/[0.01] font-medium uppercase tracking-wider border-t border-white/[0.04] first:border-t-0">
        {turretLabel}{posHint ? ` · ${posHint}` : ''}
        {item.weapon_count > 0 && <span className="text-gray-700 ml-1">({item.weapon_count}× weapons)</span>}
      </div>
      {children.length > 0 ? children.map(child => {
        const childOverride = overrides[child.port_id]
        return (
          <WeaponBlock
            key={child.port_id}
            item={childOverride ? { ...child, ...childOverride } : child}
            isCustomized={!!childOverride}
            weaponGroups={[]}
            onClickMount={() => onOpenPicker(child.port_id, child.port_type)}
            onClickWeapon={() => onOpenPicker(child.port_id, child.port_type)}
            onAddToCart={() => onAddToCart?.(child)}
          />
        )
      }) : (
        // Turret with no separate mount children — show the resolved weapon directly
        <WeaponBlock
          key={`${item.port_id}-weapon`}
          item={override ? { ...item, ...override } : item}
          isCustomized={isOverridden}
          weaponGroups={[]}
          onClickMount={() => onOpenPicker(item.port_id, item.port_type)}
          onClickWeapon={() => onOpenPicker(item.port_id, item.port_type)}
          onAddToCart={() => onAddToCart?.(item)}
        />
      )}
    </div>
  )
}
