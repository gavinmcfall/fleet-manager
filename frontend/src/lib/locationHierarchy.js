/**
 * Star Citizen location hierarchy for organizing shops by System → Planet → Body.
 *
 * Each node has:
 *   - name: display name
 *   - labels: array of shop `location_label` values that belong here
 *   - children: optional nested nodes
 *
 * A shop is placed under every node whose `labels` array includes its
 * `location_label`. Shops with no match end up in "Other".
 */

/** @typedef {{ name: string, labels?: string[], children?: LocationNode[] }} LocationNode */

/** @type {LocationNode[]} */
export const LOCATION_TREE = [
  {
    name: 'Stanton',
    children: [
      {
        name: 'Hurston',
        children: [
          { name: 'Lorville', labels: ['Lorville', 'Green Imperial Housing Exchange'] },
          { name: 'Everus Harbor', labels: ['Everus Harbor'] },
          {
            name: 'Hurston Moons',
            children: [
              { name: 'Aberdeen', labels: ['Aberdeen', 'HDMS-Edmond', 'HDMS-Hadley'] },
              { name: 'Arial', labels: ['Arial', 'HDMS-Bezdek', 'HDMS-Lathan'] },
              { name: 'Ita', labels: ['Ita', 'HDMS-Oparei', 'HDMS-Pinewood'] },
              { name: 'Magda', labels: ['Magda', 'HDMS-Anderson', 'HDMS-Hahn', 'HDMS-Norgaard', 'HDMS-Perlman', 'HDMS-Ryder', 'HDMS-Stanhope', 'HDMS-Thedus', 'HDMS-Woodruff'] },
            ],
          },
          {
            name: 'Hurston Outposts',
            labels: ['Deakins Research', 'Hickes Research', 'Reclamation & Disposal Orinth',
              "Samson & Son's Salvage Center", 'Terra Mills HydroFarm'],
          },
        ],
      },
      {
        name: 'Crusader',
        children: [
          { name: 'Orison', labels: ['Orison'] },
          { name: 'Seraphim Station', labels: ['Seraphim Station'] },
          {
            name: 'Crusader Moons',
            children: [
              { name: 'Cellin', labels: ['Cellin'] },
              {
                name: 'Daymar', labels: ['Daymar',
                  'Shubin Mining Facility SM0-10', 'Shubin Mining Facility SM0-13',
                  'Shubin Mining Facility SM0-18', 'Shubin Mining Facility SM0-22',
                  'Shubin Mining Facility SCD-1'],
              },
              { name: 'Yela', labels: ['Yela'] },
            ],
          },
        ],
      },
      {
        name: 'ArcCorp',
        children: [
          { name: 'Area 18', labels: ['Area18', 'Area 18'] },
          { name: 'Baijini Point', labels: ['Baijini Point'] },
          {
            name: 'ArcCorp Moons',
            children: [
              {
                name: 'Lyria', labels: ['Lyria',
                  'Shubin Mining Facility SAL-2', 'Shubin Mining Facility SAL-5'],
              },
              {
                name: 'Wala', labels: ['Wala',
                  'ArcCorp Mining Area 045', 'ArcCorp Mining Area 048',
                  'ArcCorp Mining Area 056', 'ArcCorp Mining Area 061',
                  'ArcCorp Mining Area 141', 'ArcCorp Mining Area 157'],
              },
            ],
          },
        ],
      },
      {
        name: 'microTech',
        children: [
          { name: 'New Babbage', labels: ['New Babbage'] },
          { name: 'Port Tressler', labels: ['Port Tressler'] },
          {
            name: 'microTech Moons',
            children: [
              {
                name: 'Calliope', labels: ['Calliope',
                  'Shubin Mining Facility SMCa-6', 'Shubin Mining Facility SMCa-8',
                  'Rayari Anvik Research Outpost', 'Rayari Cantwell Research Outpost'],
              },
              {
                name: 'Clio', labels: ['Clio',
                  'Rayari Deltana Research Outpost', 'Rayari Kaltag Research Outpost',
                  'Rayari McGrath Research Outpost'],
              },
              { name: 'Euterpe', labels: ['Euterpe'] },
            ],
          },
        ],
      },
      {
        name: 'Lagrange Stations',
        children: [
          { name: 'HUR-L1 Green Glade Station', labels: ['HUR-L1', 'HUR-L1 Green Glade Station'] },
          { name: 'HUR-L2 Faithful Dream Station', labels: ['HUR-L2', 'HUR-L2 Faithful Dream Station'] },
          { name: 'HUR-L3 Thundering Express Station', labels: ['HUR-L3', 'HUR-L3 Thundering Express Station'] },
          { name: 'HUR-L4 Melodic Fields Station', labels: ['HUR-L4', 'HUR-L4 Melodic Fields Station'] },
          { name: 'HUR-L5 High Course Station', labels: ['HUR-L5', 'HUR-L5 High Course Station'] },
          { name: 'CRU-L1 Ambitious Dream Station', labels: ['CRU-L1', 'CRU-L1 Ambitious Dream Station'] },
          { name: 'CRU-L4 Shallow Fields Station', labels: ['CRU-L4', 'CRU-L4 Shallow Fields Station'] },
          { name: 'CRU-L5 Beautiful Glen Station', labels: ['CRU-L5', 'CRU-L5 Beautiful Glen Station'] },
          { name: 'ARC-L1 Wide Forest Station', labels: ['ARC-L1', 'ARC-L1 Wide Forest Station'] },
          { name: 'ARC-L2 Lively Pathway Station', labels: ['ARC-L2', 'ARC-L2 Lively Pathway Station'] },
          { name: 'ARC-L3 Modern Express Station', labels: ['ARC-L3', 'ARC-L3 Modern Express Station'] },
          { name: 'ARC-L4 Faint Glen Station', labels: ['ARC-L4', 'ARC-L4 Faint Glen Station'] },
          { name: 'ARC-L5 Yellow Core Station', labels: ['ARC-L5', 'ARC-L5 Yellow Core Station'] },
          { name: 'MIC-L1 Shallow Frontier Station', labels: ['MIC-L1', 'MIC-L1 Shallow Frontier Station'] },
          { name: 'MIC-L2 Long Forest Station', labels: ['MIC-L2', 'MIC-L2 Long Forest Station'] },
          { name: 'MIC-L3 Endless Odyssey Station', labels: ['MIC-L3', 'MIC-L3 Endless Odyssey Station'] },
          { name: 'MIC-L4 Red Crossroads Station', labels: ['MIC-L4', 'MIC-L4 Red Crossroads Station'] },
          { name: 'MIC-L5 Modern Icarus Station', labels: ['MIC-L5', 'MIC-L5 Modern Icarus Station'] },
        ],
      },
      {
        name: 'Gateways',
        labels: ['Stanton Gateway', 'Pyro Gateway',
          'Pyro Gateway (Stanton)', 'Nyx Gateway (Stanton)',
          'Terra Gateway (Stanton)'],
      },
      {
        name: 'Grim HEX',
        labels: ['Grim HEX', 'GrimHEX'],
      },
      {
        name: 'Rest Stops',
        labels: ['All Rest Stops', 'Rest Stops'],
      },
      {
        name: 'Outposts',
        labels: ['Outposts'],
      },
    ],
  },
  {
    name: 'Pyro',
    children: [
      { name: 'Pyro I', labels: ['Pyro I'] },
      { name: 'Pyro II: Monox', labels: ['Monox', 'Pyro II'] },
      { name: 'Pyro III: Bloom', labels: ['Bloom', 'Pyro III'] },
      { name: 'Pyro IV', labels: ['Pyro IV'] },
      { name: 'Pyro V', labels: ['Pyro V'] },
      { name: 'Pyro VI: Terminus', labels: ['Terminus', 'Pyro VI'] },
      {
        name: 'Pyro Stations',
        labels: ['Pyro Gateway', 'Ruin Station', 'Checkmate Station', 'Endgame',
          'Stanton Gateway (Pyro)', 'Nyx Gateway (Pyro)',
          "People's Service Station Alpha", "People's Service Station Delta",
          "People's Service Station Lambda", "People's Service Station Theta"],
      },
      {
        name: 'Pyro Settlements',
        labels: [
          'Arid Reach', 'Ashland', "Astor's Clearing", 'Blackrock Exchange',
          "Brio's Breaker Yard", 'Bueno Ravine', "Bullock's Reach",
          'Canard View', "Carver's Ridge", "Chawla's Beach",
          'Devlin Scrap & Salvage', "Dudley & Daughters", 'Dunboro',
          'Fallow Field', 'Feo Canyon Depot', 'Frigid Knot', 'Frostbite',
          'Gaslight', "Goner's Deal", "Jackson's Swap", "Kabir's Post",
          'Kinder Plots', 'Last Landings', 'Megumi Refueling',
          "Narena's Rest", 'Orbituary', "Ostler's Claim",
          'Patch City', "Picker's Field", "Prophet's Peak", 'Rappel',
          "Rat's Nest", "Rod's Fuel 'N Supplies", 'Rough Landing',
          'Rustville', "Sacren's Plot", "Scarper's Turn", "Seer's Canyon",
          "Shepherd's Rest", 'Slowburn Depot', "Stag's Rut",
          'Starlight Service Station', 'Sunset Mesa', 'The Golden Riviera',
          'The Yard', 'Windfall', "Yang's Place", 'Zephyr',
        ],
      },
    ],
  },
  {
    name: 'Nyx',
    children: [
      { name: 'Levski', labels: ['Levski'] },
      {
        name: 'Nyx Gateways',
        labels: ['Stanton Gateway (Nyx)', 'Pyro Gateway (Nyx)'],
      },
    ],
  },
]

/**
 * Assign shops to location tree nodes.
 * Returns a new tree with `shops` arrays populated.
 *
 * A shop is placed under every node whose `labels` include its `location_name`.
 * Shops with no match end up in `unmatched`.
 *
 * @param {LocationNode[]} tree
 * @param {Array<{location_name?: string}>} shops
 * @returns {{ tree: LocationNode[], unmatched: any[] }}
 */
export function assignShopsToTree(tree, shops) {
  // Build label → node paths index (one label can map to many nodes)
  /** @type {Map<string, string[][]>} */
  const labelIndex = new Map()
  function indexNode(node, path) {
    if (node.labels) {
      for (const label of node.labels) {
        if (!labelIndex.has(label)) labelIndex.set(label, [])
        labelIndex.get(label).push(path)
      }
    }
    if (node.children) {
      for (const child of node.children) {
        indexNode(child, [...path, child.name])
      }
    }
  }
  for (const root of tree) {
    indexNode(root, [root.name])
  }

  // Deep clone tree and add shops arrays
  function cloneNode(node) {
    const clone = { ...node, shops: [] }
    if (node.children) {
      clone.children = node.children.map(cloneNode)
    }
    return clone
  }
  const clonedTree = tree.map(cloneNode)

  // Find node by path in cloned tree
  function findNode(path) {
    let nodes = clonedTree
    let current = null
    for (const name of path) {
      current = nodes.find(n => n.name === name)
      if (!current) return null
      nodes = current.children || []
    }
    return current
  }

  const unmatched = []
  for (const shop of shops) {
    const label = shop.location_name
    if (!label) {
      unmatched.push(shop)
      continue
    }
    const paths = labelIndex.get(label)
    if (paths) {
      let placed = false
      for (const path of paths) {
        const node = findNode(path)
        if (node) {
          node.shops.push(shop)
          placed = true
        }
      }
      if (placed) continue
    }
    unmatched.push(shop)
  }

  return { tree: clonedTree, unmatched }
}

/**
 * Count total shops in a node and its descendants.
 * @param {LocationNode & { shops?: any[] }} node
 * @returns {number}
 */
export function countShopsInNode(node) {
  let count = node.shops?.length || 0
  if (node.children) {
    for (const child of node.children) {
      count += countShopsInNode(child)
    }
  }
  return count
}
