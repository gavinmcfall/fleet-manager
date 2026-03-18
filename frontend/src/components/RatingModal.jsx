import React, { useState } from 'react'
import { Star, X, Loader2, AlertCircle, Check } from 'lucide-react'

const CATEGORIES = [
  { key: 'reliability', label: 'Reliability', desc: 'Shows up on time, follows through' },
  { key: 'skill', label: 'Skill', desc: 'Competent at their role' },
  { key: 'communication', label: 'Communication', desc: 'Responsive, clear, keeps team informed' },
  { key: 'fairness', label: 'Fairness', desc: 'Honest, fair dealings, trustworthy' },
]

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              n <= (hover || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-700 hover:text-gray-500'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function RatingModal({ slug, opId, rateeUserId, rateeName, onClose, onRated }) {
  const [scores, setScores] = useState({})
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const setScore = (category, score) => {
    setScores(prev => ({ ...prev, [category]: score }))
  }

  const allRated = CATEGORIES.every(c => scores[c.key])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allRated) return
    setSaving(true)
    setError(null)
    try {
      const ratings = CATEGORIES.map(c => ({
        category: c.key,
        score: scores[c.key],
      }))
      const resp = await fetch(`/api/orgs/${slug}/ops/${opId}/rate/${rateeUserId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings, comment: comment.trim() || null }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to submit rating')
      setSuccess(true)
      setTimeout(() => {
        onRated?.()
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="panel p-6 max-w-md w-full space-y-4 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display uppercase tracking-widest text-gray-400">
            Rate {rateeName}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4" />
            <span>Rating submitted</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {CATEGORIES.map(({ key, label, desc }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white">{label}</span>
                    <p className="text-[10px] text-gray-600">{desc}</p>
                  </div>
                  <StarPicker value={scores[key] || 0} onChange={(v) => setScore(key, v)} />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none h-20 resize-none"
                placeholder="How was working with them?"
                maxLength={2000}
              />
            </div>

            <button
              type="submit"
              disabled={!allRated || saving}
              className="btn-primary w-full px-4 py-2.5 font-display tracking-wider uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
              {saving ? 'Submitting...' : 'Submit Rating'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
