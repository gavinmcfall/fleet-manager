import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAIAnalysisHistory, deleteAIAnalysis } from '../hooks/useAPI'
import { Clock, Sparkles, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'

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

  if (loading) return <LoadingState message="Loading history..." />
  if (error) return <ErrorState message={error} />

  const history = data?.history || []

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="ANALYSIS HISTORY"
          subtitle="Past AI fleet analyses"
        />
        <EmptyState
          icon={Sparkles}
          message="No analyses yet. Generate your first AI fleet analysis!"
          large
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ANALYSIS HISTORY"
        subtitle={`Past AI fleet analyses (${history.length} total)`}
      />

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
