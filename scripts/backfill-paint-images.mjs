#!/usr/bin/env node
/**
 * Paint image backfill — fetch missing paint images from Fleetyards API.
 *
 * Run after a fresh DB load or paint extraction to fill image gaps.
 * The RSI nightly sync handles ~85% of paint images. This script covers
 * the remaining ~10% from Fleetyards CDN.
 *
 * Usage:
 *   1. Export missing paints from DB:
 *      source ~/.secrets && npx wrangler d1 execute <DB> --remote --json \
 *        --command "SELECT p.id, p.name, p.slug, GROUP_CONCAT(DISTINCT v.slug) as vehicle_slugs \
 *        FROM paints p JOIN paint_vehicles pv ON pv.paint_id = p.id \
 *        JOIN vehicles v ON v.id = pv.vehicle_id \
 *        WHERE p.image_url IS NULL GROUP BY p.id ORDER BY p.name" \
 *        | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)[0]['results']))" \
 *        > /tmp/missing-paints.json
 *
 *   2. Run this script:
 *      cat /tmp/missing-paints.json | node scripts/backfill-paint-images.mjs
 *
 *   3. Apply the generated SQL:
 *      source ~/.secrets && npx wrangler d1 execute <DB> --remote --file=/tmp/paint-image-backfill.sql
 */

const DRY_RUN = process.argv.includes('--dry-run')
const API_BASE = 'https://api.fleetyards.net/v1'

// Fetch with retry
async function fetchJSON(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.json()
    } catch (err) {
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
}

// Normalize paint name for fuzzy matching
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\s*paint\s*/g, ' ')
    .replace(/\s*livery\s*/g, ' ')
    .replace(/\s*skin\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  // Step 1: Read all paints missing images + their vehicle slugs from stdin SQL output
  // We'll hardcode the fetch from Fleetyards for all unique vehicle slugs

  console.log('Fetching missing paints list...')

  // Read the pre-generated JSON from stdin
  const input = await new Promise(resolve => {
    let data = ''
    process.stdin.on('data', chunk => data += chunk)
    process.stdin.on('end', () => resolve(JSON.parse(data)))
  })

  const missingPaints = input // [{id, name, slug, vehicle_slugs}]
  console.log(`${missingPaints.length} paints missing images`)

  // Collect unique vehicle slugs
  const vehicleSlugs = [...new Set(missingPaints.flatMap(p => p.vehicle_slugs.split(',')))]
  console.log(`${vehicleSlugs.length} unique vehicles to query`)

  // Step 2: Fetch paints from Fleetyards for each vehicle
  const fyPaintsByVehicle = new Map()
  let fetched = 0

  for (const slug of vehicleSlugs) {
    const paints = await fetchJSON(`${API_BASE}/models/${slug}/paints`)
    if (paints && Array.isArray(paints)) {
      fyPaintsByVehicle.set(slug, paints)
      const withImg = paints.filter(p => p.storeImageMedium).length
      if (withImg > 0) console.log(`  ${slug}: ${paints.length} paints (${withImg} with images)`)
    } else {
      // Try common alternate slugs
      const alts = getAlternateSlugs(slug)
      let found = false
      for (const alt of alts) {
        const altPaints = await fetchJSON(`${API_BASE}/models/${alt}/paints`)
        if (altPaints && Array.isArray(altPaints)) {
          fyPaintsByVehicle.set(slug, altPaints)
          const withImg = altPaints.filter(p => p.storeImageMedium).length
          if (withImg > 0) console.log(`  ${slug} → ${alt}: ${altPaints.length} paints (${withImg} with images)`)
          found = true
          break
        }
      }
      if (!found) console.log(`  ${slug}: not found on Fleetyards`)
    }
    fetched++
    if (fetched % 20 === 0) console.log(`  ...${fetched}/${vehicleSlugs.length} vehicles queried`)
    // Be polite
    await new Promise(r => setTimeout(r, 100))
  }

  // Step 3: Match our paints to Fleetyards paints by name
  const updates = []
  const noMatchList = []
  let matched = 0
  let noMatch = 0
  let noImage = 0

  for (const paint of missingPaints) {
    const vSlugs = paint.vehicle_slugs.split(',')
    const normName = normalize(paint.name)

    let bestMatch = null

    for (const vs of vSlugs) {
      const fyPaints = fyPaintsByVehicle.get(vs) || []

      for (const fyp of fyPaints) {
        // Try exact name match first
        if (normalize(fyp.name) === normName) {
          bestMatch = fyp
          break
        }
        // Try nameWithModel match (e.g. "100i - Auspicious Red Dog")
        if (normalize(fyp.nameWithModel) === normName) {
          bestMatch = fyp
          break
        }
        // Try partial: our name contains their name or vice versa
        const fyNorm = normalize(fyp.name)
        if (normName.includes(fyNorm) || fyNorm.includes(normName)) {
          bestMatch = fyp
          break
        }
      }
      if (bestMatch) break
    }

    if (!bestMatch) {
      // Try stripping common prefixes like "300 Series", "Aurora", "Constellation" etc.
      const stripped = paint.name
        .replace(/^\d+\w?\s+Series\s+/i, '')       // "300 Series X" → "X"
        .replace(/\s+(Paint|Livery|Skin)$/i, '')    // strip suffix
        .trim()
      const normStripped = normalize(stripped)

      for (const vs of vSlugs) {
        const fyPaints = fyPaintsByVehicle.get(vs) || []
        for (const fyp of fyPaints) {
          const fyNorm = normalize(fyp.name)
          if (fyNorm === normStripped) { bestMatch = fyp; break }
          // "nameWithModel" match: "300i - Golden Dawn"
          const fywm = normalize(fyp.nameWithModel || '')
          if (fywm.includes(normStripped)) { bestMatch = fyp; break }
        }
        if (bestMatch) break
      }
    }

    // Third pass: strip vehicle name prefix (e.g. "Carrack Copernicus Livery" → "Copernicus")
    if (!bestMatch) {
      for (const vs of vSlugs) {
        const fyPaints = fyPaintsByVehicle.get(vs) || []
        // Get vehicle display name from FY paints (first nameWithModel "300i - X" → "300i")
        for (const fyp of fyPaints) {
          const fyNorm = normalize(fyp.name)
          // Try stripping common vehicle names from our paint name
          let stripped2 = paint.name
          for (const prefix of [
            /^aurora\s+/i, /^carrack\s+/i, /^caterpillar\s+/i, /^corsair\s+/i,
            /^cutter\s+/i, /^dragonfly\s+/i, /^fury\s+/i, /^gladius\s+/i,
            /^guardian\s+/i, /^hercules\s+starlifter\s+/i, /^hermes\s+/i,
            /^idris\s+/i, /^m50\s+/i, /^mtc\s+/i, /^mercury\s+star\s+runner\s+/i,
            /^mule\s+/i, /^mustang\s+/i, /^nox\s+/i, /^paladin\s+/i,
            /^pisces\s+/i, /^prowler\s+/i, /^roc\s+/i, /^starlancer\s+/i,
            /^stinger\s+/i, /^syulen\s+/i, /^ursa\s+/i, /^vulture\s+/i,
            /^wolf\s+/i, /^zeus\s+mk\s+ii\s+/i, /^zeus\s+/i,
            /^ares\s+star\s+fighter\s+/i, /^apollo\s+/i, /^asgard\s+/i,
            /^clipper\s+/i, /^esperia\s+/i, /^talon\s+/i,
          ]) {
            stripped2 = stripped2.replace(prefix, '')
          }
          stripped2 = stripped2.replace(/\s+(Paint|Livery|Skin)$/i, '').trim()
          const normStripped2 = normalize(stripped2)
          if (fyNorm === normStripped2 || fyNorm.includes(normStripped2) || normStripped2.includes(fyNorm)) {
            bestMatch = fyp
            break
          }
        }
        if (bestMatch) break
      }
    }

    if (!bestMatch) {
      noMatch++
      noMatchList.push(`  ${paint.name} (${paint.vehicle_slugs})`)
      continue
    }

    const imgLarge = bestMatch.storeImageLarge || bestMatch.media?.storeImage?.large || null
    const imgMedium = bestMatch.storeImageMedium || bestMatch.media?.storeImage?.medium || null
    const imgSmall = bestMatch.storeImageSmall || bestMatch.media?.storeImage?.small || null
    const imgSource = bestMatch.storeImage || bestMatch.media?.storeImage?.source || null

    if (!imgMedium && !imgSmall && !imgSource) {
      noImage++
      continue
    }

    matched++
    updates.push({
      id: paint.id,
      name: paint.name,
      fy_name: bestMatch.name,
      image_url: imgSource || imgLarge || imgMedium,
      image_url_small: imgSmall || imgMedium,
      image_url_medium: imgMedium || imgLarge,
    })
  }

  console.log(`\nResults: ${matched} matched with images, ${noMatch} no match, ${noImage} matched but no image`)
  if (noMatchList.length > 0) {
    console.log(`\nUnmatched paints:`)
    noMatchList.forEach(l => console.log(l))
  }

  // Step 4: Generate SQL
  if (updates.length > 0) {
    const sqlLines = updates.map(u => {
      const esc = s => s ? s.replace(/'/g, "''") : 'NULL'
      const val = s => s ? `'${esc(s)}'` : 'NULL'
      return `UPDATE paints SET image_url = ${val(u.image_url)}, image_url_small = ${val(u.image_url_small)}, image_url_medium = ${val(u.image_url_medium)} WHERE id = ${u.id}; -- ${u.name}`
    })

    const sql = sqlLines.join('\n')

    if (DRY_RUN) {
      console.log('\n--- DRY RUN SQL ---')
      console.log(sql)
    } else {
      // Write SQL file
      const fs = await import('fs')
      const outPath = '/tmp/paint-image-backfill.sql'
      fs.writeFileSync(outPath, sql)
      console.log(`\nSQL written to ${outPath}`)
      console.log(`Run: source ~/.secrets && npx wrangler d1 execute sc-companion-staging-v2 --remote --env staging --config wrangler.toml --file=${outPath}`)
    }

    // Print sample
    console.log('\nSample updates:')
    for (const u of updates.slice(0, 5)) {
      console.log(`  ${u.name} → ${u.fy_name}`)
      console.log(`    ${u.image_url_medium?.substring(0, 80)}...`)
    }
  }
}

function getAlternateSlugs(slug) {
  const alts = []
  // "c2-hercules-starlifter" → "c2-hercules"
  if (slug.includes('-starlifter')) alts.push(slug.replace('-starlifter', ''))
  // "a1-spirit" → "a1-spirit" (already correct, try without prefix)
  // "ares-star-fighter-ion" → "ares-ion"
  if (slug.includes('star-fighter-')) alts.push(slug.replace('star-fighter-', ''))
  // "constellation-andromeda" → "andromeda"
  if (slug.startsWith('constellation-')) alts.push(slug.replace('constellation-', ''))
  // wikelo/special variants → base
  if (slug.includes('-wikelo-')) alts.push(slug.split('-wikelo-')[0])
  if (slug.includes('-best-in-show')) alts.push(slug.split('-best-in-show')[0])
  // "drake-caterpillar" → "caterpillar"
  for (const prefix of ['drake-', 'anvil-', 'aegis-', 'rsi-', 'misc-', 'crusader-', 'origin-', 'argo-', 'mirai-', 'tumbril-', 'consolidated-outland-', 'co-', 'greycat-', 'gatac-', 'banu-', 'esperia-', 'kruger-', 'musashi-']) {
    if (slug.startsWith(prefix)) alts.push(slug.slice(prefix.length))
  }
  return alts
}

main().catch(err => { console.error(err); process.exit(1) })
