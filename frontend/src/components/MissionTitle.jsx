/**
 * PART K K9: render mission titles + descriptions that carry template
 * variables CIG fills at runtime.
 *
 * 63% of mission rows on prod ship with literal `{}` placeholders in the
 * title — players see "Wildlife Control: {Creature}" instead of a tagged
 * token. The extractor (tools commit 2e43148, PART K K4) now rewrites these
 * to `<var name="Creature"/>` at extract time. This component renders
 * BOTH shapes:
 *
 *   - `<var name="X"/>` — new on-disk form once the next extractor run lands
 *   - `{X}` — legacy curly-brace form still on staging/prod until re-extract
 *
 * Tagged segments render as styled inline chips with a tooltip showing the
 * variable name (and a future pool reference if available).
 */
import React from 'react'

const TAG_RE = /<var name="([^"]+)"\s*\/>|\{([A-Za-z_][A-Za-z0-9_]*)\}/g

export function TemplateVar({ name, pool }) {
  const title = pool && pool.length
    ? `One of: ${pool.join(', ')}`
    : `Template variable — runtime-filled by CIG: ${name}`
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mx-0.5 align-middle"
      title={title}
    >
      {name}
    </span>
  )
}

export function MissionTitle({ title, pools }) {
  if (!title) return null
  if (typeof title !== 'string') return <>{String(title)}</>
  if (!TAG_RE.test(title)) return <>{title}</>

  // Reset lastIndex — RegExp.test mutates it on global regex
  TAG_RE.lastIndex = 0

  const parts = []
  let lastIdx = 0
  let match
  let key = 0
  while ((match = TAG_RE.exec(title)) !== null) {
    if (match.index > lastIdx) {
      parts.push(title.slice(lastIdx, match.index))
    }
    const name = match[1] || match[2]
    const pool = pools && pools[name] ? pools[name] : null
    parts.push(<TemplateVar key={`v-${key++}`} name={name} pool={pool} />)
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < title.length) {
    parts.push(title.slice(lastIdx))
  }
  return <>{parts}</>
}
