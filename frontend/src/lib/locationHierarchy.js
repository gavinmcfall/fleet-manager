/**
 * Star Citizen location hierarchy for organizing shops by System → Planet → Body.
 *
 * Each node has:
 *   - name: display name
 *   - labels: array of shop `location_label` values that belong here
 *   - children: optional nested nodes
 *
 * Labels like 'All Rest Stops' and 'Outposts' are shared across many nodes —
 * a shop with that label appears under every node that lists it.
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
          { name: 'Lorville', labels: ['Lorville'] },
          { name: 'Everus Harbor', labels: ['Everus Harbor', 'All Rest Stops'] },
          {
            name: 'Hurston Moons',
            children: [
              { name: 'Aberdeen', labels: ['Aberdeen', 'Outposts'] },
              { name: 'Arial', labels: ['Arial', 'Outposts'] },
              { name: 'Ita', labels: ['Ita', 'Outposts'] },
              { name: 'Magda', labels: ['Magda', 'Outposts'] },
            ],
          },
        ],
      },
      {
        name: 'Crusader',
        children: [
          { name: 'Orison', labels: ['Orison'] },
          { name: 'Seraphim Station', labels: ['Seraphim Station', 'All Rest Stops'] },
          {
            name: 'Crusader Moons',
            children: [
              { name: 'Cellin', labels: ['Cellin', 'Outposts'] },
              { name: 'Daymar', labels: ['Daymar', 'Outposts'] },
              { name: 'Yela', labels: ['Yela', 'Outposts'] },
            ],
          },
        ],
      },
      {
        name: 'ArcCorp',
        children: [
          { name: 'Area18', labels: ['Area18'] },
          { name: 'Baijini Point', labels: ['Baijini Point', 'All Rest Stops'] },
          {
            name: 'ArcCorp Moons',
            children: [
              { name: 'Lyria', labels: ['Lyria', 'Outposts'] },
              { name: 'Wala', labels: ['Wala', 'Outposts'] },
            ],
          },
        ],
      },
      {
        name: 'microTech',
        children: [
          { name: 'New Babbage', labels: ['New Babbage'] },
          { name: 'Port Tressler', labels: ['Port Tressler', 'All Rest Stops'] },
          {
            name: 'microTech Moons',
            children: [
              { name: 'Calliope', labels: ['Calliope', 'Outposts'] },
              { name: 'Clio', labels: ['Clio', 'Outposts'] },
              { name: 'Euterpe', labels: ['Euterpe', 'Outposts'] },
            ],
          },
        ],
      },
      {
        name: 'Lagrange Stations',
        children: [
          { name: 'HUR-L1 Green Glade Station', labels: ['HUR-L1', 'All Rest Stops'] },
          { name: 'HUR-L2 Faithful Dream Station', labels: ['HUR-L2', 'All Rest Stops'] },
          { name: 'HUR-L3 Thundering Express Station', labels: ['HUR-L3', 'All Rest Stops'] },
          { name: 'HUR-L4 Melodic Fields Station', labels: ['HUR-L4', 'All Rest Stops'] },
          { name: 'HUR-L5 High Course Station', labels: ['HUR-L5', 'All Rest Stops'] },
          { name: 'CRU-L1 Ambitious Dream Station', labels: ['CRU-L1', 'All Rest Stops'] },
          { name: 'CRU-L4 Shallow Fields Station', labels: ['CRU-L4', 'All Rest Stops'] },
          { name: 'CRU-L5 Beautiful Glen Station', labels: ['CRU-L5', 'All Rest Stops'] },
          { name: 'ARC-L1 Wide Forest Station', labels: ['ARC-L1', 'All Rest Stops'] },
          { name: 'ARC-L2 Lively Pathway Station', labels: ['ARC-L2', 'All Rest Stops'] },
          { name: 'ARC-L3 Modern Express Station', labels: ['ARC-L3', 'All Rest Stops'] },
          { name: 'ARC-L4 Faint Glen Station', labels: ['ARC-L4', 'All Rest Stops'] },
          { name: 'ARC-L5 Yellow Core Station', labels: ['ARC-L5', 'All Rest Stops'] },
          { name: 'MIC-L1 Shallow Frontier Station', labels: ['MIC-L1', 'All Rest Stops'] },
          { name: 'MIC-L2 Long Forest Station', labels: ['MIC-L2', 'All Rest Stops'] },
          { name: 'MIC-L3 Endless Odyssey Station', labels: ['MIC-L3', 'All Rest Stops'] },
          { name: 'MIC-L4 Red Crossroads Station', labels: ['MIC-L4', 'All Rest Stops'] },
          { name: 'MIC-L5 Modern Icarus Station', labels: ['MIC-L5', 'All Rest Stops'] },
        ],
      },
      {
        name: 'Gateways',
        labels: ['Stanton Gateway', 'Pyro Gateway'],
      },
      {
        name: 'Grim HEX',
        labels: ['Grim HEX'],
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
        labels: ['Pyro Gateway', 'Ruin Station'],
      },
    ],
  },
  {
    name: 'Nyx',
    children: [
      { name: 'Levski', labels: ['Levski'] },
    ],
  },
]

/**
 * Assign shops to location tree nodes.
 * Returns a new tree with `shops` arrays populated.
 *
 * Shared labels (like 'All Rest Stops') cause a shop to appear under
 * every node that lists that label — not just the first match.
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
