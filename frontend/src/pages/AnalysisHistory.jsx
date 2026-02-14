import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAIAnalysisHistory, deleteAIAnalysis } from '../hooks/useAPI'
import { Clock, Sparkles, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

export default function AnalysisHistory() {
  const { data, loading, error, refetch } = useAIAnalysisHistory()
  const [expandedId, setExpandedId] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const handleDelete = async (id, e) => {
    e.stopPropagation() // Prevent expanding/collapsing when clicking delete

    if (!confirm('Are you sure you want to delete this analysis? This cannot be undone.')) {
      return
    }

    setDeleting(id)
    try {
      await deleteAIAnalysis(id)
      await refetch() // Refresh the list
      if (expandedId === id) {
        setExpandedId(null) // Collapse if it was expanded
      }
    } catch (err) {
      alert('Failed to delete analysis: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="text-gray-500 font-mono text-sm p-8">Loading history...</div>
  if (error) return <div className="text-sc-danger font-mono text-sm p-8">Error: {error}</div>

  const history = data?.history || []

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">ANALYSIS HISTORY</h2>
          <p className="text-xs font-mono text-gray-500 mt-1">
            Past AI fleet analyses
          </p>
        </div>

        <div className="glow-line" />

        <div className="panel p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-500 text-sm">No analyses yet. Generate your first AI fleet analysis!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">ANALYSIS HISTORY</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Past AI fleet analyses ({history.length} total)
        </p>
      </div>

      <div className="glow-line" />

      <div className="space-y-3">
        {history.map((item) => {
          const isExpanded = expandedId === item.id
          const date = new Date(item.created_at)
          const formattedDate = date.toLocaleString('en-NZ', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div key={item.id} className="panel">
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4 text-left">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-sc-accent flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm font-mono text-gray-400">{formattedDate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sc-accent" />
                    <span className="text-xs text-gray-500">
                      {item.provider} / {item.model}
                    </span>
                  </div>

                  <span className="text-xs text-gray-600">
                    {item.vehicle_count} ships
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    disabled={deleting === item.id}
                    className="p-1.5 rounded hover:bg-sc-danger/10 text-gray-500 hover:text-sc-danger transition-colors disabled:opacity-50"
                    title="Delete this analysis"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-xs text-gray-600">
                    {isExpanded ? 'Hide' : 'View'}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-sc-border p-5">
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                    <ReactMarkdown>{item.analysis}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
