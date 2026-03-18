/**
 * Op payout calculation: ratio + time proration.
 *
 * 1. Capital is returned first: distributable = totalEarnings - totalPaidCapital
 * 2. For each participant:
 *    - baseWeight = payout_ratio ?? 1.0
 *    - activeTime = (left_at ?? completedAt) - joined_at (clamped to op window)
 *    - timeMultiplier = activeTime / totalOpTime
 *    - effectiveWeight = baseWeight * timeMultiplier
 * 3. share = ROUND(effectiveWeight / sumAllEffectiveWeights * distributable)
 * 4. Remainder (rounding) goes to op creator
 */

export interface ParticipantInput {
  user_id: string;
  payout_ratio: number | null;
  joined_at: string;
  left_at: string | null;
  logged_off: number;
}

export interface PayoutResult {
  user_id: string;
  amount: number;
}

export function calculatePayouts(
  participants: ParticipantInput[],
  totalEarnings: number,
  totalPaidCapital: number,
  startedAt: string,
  completedAt: string,
  createdBy: string,
): PayoutResult[] {
  const distributable = totalEarnings - totalPaidCapital;
  if (distributable <= 0 || participants.length === 0) {
    return participants.map((p) => ({ user_id: p.user_id, amount: 0 }));
  }

  const opStart = new Date(startedAt + "Z").getTime();
  const opEnd = new Date(completedAt + "Z").getTime();
  const totalOpTime = Math.max(opEnd - opStart, 1); // prevent division by zero

  // Calculate effective weights
  const weights: { user_id: string; weight: number }[] = [];
  let totalWeight = 0;

  for (const p of participants) {
    const baseWeight = p.payout_ratio ?? 1.0;

    // Clamp join/leave to op window
    const joinTime = Math.max(new Date(p.joined_at + "Z").getTime(), opStart);
    const leaveTime = p.left_at
      ? Math.min(new Date(p.left_at + "Z").getTime(), opEnd)
      : opEnd;

    const activeTime = Math.max(leaveTime - joinTime, 0);
    const timeMultiplier = activeTime / totalOpTime;
    const effectiveWeight = baseWeight * timeMultiplier;

    weights.push({ user_id: p.user_id, weight: effectiveWeight });
    totalWeight += effectiveWeight;
  }

  if (totalWeight === 0) {
    // Everyone had zero active time — equal split
    const equalShare = Math.floor(distributable / participants.length);
    const results = participants.map((p) => ({ user_id: p.user_id, amount: equalShare }));
    // Give remainder to creator
    const allocated = equalShare * participants.length;
    const creatorIdx = results.findIndex((r) => r.user_id === createdBy);
    if (creatorIdx >= 0) {
      results[creatorIdx].amount += distributable - allocated;
    } else if (results.length > 0) {
      results[0].amount += distributable - allocated;
    }
    return results;
  }

  // Calculate shares
  const results: PayoutResult[] = weights.map((w) => ({
    user_id: w.user_id,
    amount: Math.round((w.weight / totalWeight) * distributable),
  }));

  // Fix rounding error — give remainder to creator
  const allocated = results.reduce((sum, r) => sum + r.amount, 0);
  const remainder = distributable - allocated;
  if (remainder !== 0) {
    const creatorIdx = results.findIndex((r) => r.user_id === createdBy);
    if (creatorIdx >= 0) {
      results[creatorIdx].amount += remainder;
    } else if (results.length > 0) {
      results[0].amount += remainder;
    }
  }

  return results;
}
