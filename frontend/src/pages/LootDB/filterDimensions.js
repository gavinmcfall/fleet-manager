// Multi-dimensional filter config per effective category.
// Each dimension defines: URL key, item field to match, display label, and value labels.
// multiValue: true means the field is comma-separated (match ANY token).
// numeric: true means values are auto-derived from data, sorted numerically.

export const FILTER_DIMENSIONS = {
  weapon: [
    {
      key: 'weapon_type',
      field: 'sub_type',
      label: 'Type',
      values: { Small: 'Pistols', Medium: 'Rifles', Large: 'Heavy', Gadget: 'Gadgets' },
    },
    {
      key: 'fire_mode',
      field: 'weapon_fire_modes',
      label: 'Fire Mode',
      multiValue: true,
      values: { Single: 'Single', Rapid: 'Full Auto', Burst: 'Burst', Beam: 'Beam', Charge: 'Charge' },
    },
  ],
  armour: [
    {
      key: 'piece',
      field: 'type',
      label: 'Piece',
      values: {
        Char_Armor_Helmet: 'Helmets', Char_Armor_Torso: 'Core', Char_Armor_Arms: 'Arms',
        Char_Armor_Legs: 'Legs', Char_Armor_Backpack: 'Backpacks', Char_Armor_Undersuit: 'Undersuits',
      },
    },
    {
      key: 'weight',
      field: 'armour_weight',
      label: 'Weight',
      values: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    },
  ],
  ship_component: [
    {
      key: 'comp_type',
      field: 'type',
      label: 'Type',
      values: {
        PowerPlant: 'Power Plants', Cooler: 'Coolers', Shield: 'Shields',
        QuantumDrive: 'Quantum Drives', Radar: 'Radar', MiningModifier: 'Mining',
        TractorBeam: 'Tractor Beams',
      },
    },
    { key: 'size', field: 'comp_size', label: 'Size', numeric: true },
    {
      key: 'grade',
      field: 'comp_grade',
      label: 'Grade',
      values: { A: 'A', B: 'B', C: 'C', D: 'D' },
    },
  ],
  ship_weapon: [
    { key: 'size', field: 'comp_size', label: 'Size', numeric: true },
    {
      key: 'damage_type',
      field: 'damage_type',
      label: 'Damage',
      values: { Physical: 'Physical', Energy: 'Energy', Distortion: 'Distortion' },
    },
  ],
  missile: [
    {
      key: 'tracking',
      field: 'tracking_signal',
      label: 'Tracking',
      values: { Infrared: 'IR', Electromagnetic: 'EM', CrossSection: 'CS' },
    },
  ],
  attachment: [
    {
      key: 'attach_type',
      field: 'sub_type',
      label: 'Type',
      values: { IronSight: 'Sights', Barrel: 'Barrels', BottomAttachment: 'Underbarrel', Utility: 'Utility', Magazine: 'Magazines' },
    },
  ],
  clothing: [
    {
      key: 'slot',
      field: 'type',
      label: 'Slot',
      values: {
        Char_Clothing_Hat: 'Hats', Char_Clothing_Torso_0: 'Shirts', Char_Clothing_Torso_1: 'Jackets',
        Char_Clothing_Legs: 'Pants', Char_Clothing_Feet: 'Boots', Char_Clothing_Hands: 'Gloves',
        Char_Accessory_Eyes: 'Eyewear',
      },
    },
  ],
}
