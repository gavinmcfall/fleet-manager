/**
 * PART K K12: render a mission's reward shape.
 *
 * Per K1 verdict (2026-05-18), missions have NO blueprint-pool reward chain
 * — just `missionReward` (currency + amount or range) and optional
 * `reputationBonus`. The original plan called for a collapsible item-pool
 * UI; that's deferred to the Contracts page where 925 contract_generator_blueprint_pools
 * rows actually exist. For missions this is just a compact inline summary.
 *
 * Shape:
 *   "Reward: 4,000–7,500 UEC"     ← when reward_max > reward_amount
 *   "Reward: 4,000 UEC"           ← when reward_max === reward_amount or is null/0
 *   "Reward: Dynamic"             ← when is_dynamic_reward=1
 *   "Reward: 2,000 MER"           ← Klescher prison missions
 *   (returns null when neither value present)
 */
import React from 'react'

function fmt(n) {
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString('en-US')
}

export function RewardSummary({ mission }) {
  if (!mission) return null
  const {
    reward_amount,
    reward_max,
    reward_currency,
    is_dynamic_reward,
  } = mission

  const currency = reward_currency || 'UEC'
  let body

  if (is_dynamic_reward) {
    body = <span className="text-sc-accent2 italic">Dynamic</span>
  } else if (typeof reward_amount === 'number' && reward_amount > 0) {
    if (typeof reward_max === 'number' && reward_max > reward_amount) {
      body = (
        <span className="font-mono tabular-nums">
          {fmt(reward_amount)}–{fmt(reward_max)} {currency}
        </span>
      )
    } else {
      body = (
        <span className="font-mono tabular-nums">
          {fmt(reward_amount)} {currency}
        </span>
      )
    }
  } else {
    return null
  }

  return (
    <span className="text-xs text-gray-300">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mr-1">Reward:</span>
      {body}
    </span>
  )
}
