import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAnalysis, useLLMConfig, generateAIAnalysis, useLatestAIAnalysis } from '../hooks/useAPI'
import { AlertCircle, AlertTriangle, Info, Copy, ChevronRight, Sparkles, Loader } from 'lucide-react'

const PRIORITY_CONFIG = {
  high: { icon: AlertCircle, color: 'text-sc-danger', bg: 'bg-sc-danger/10', border: 'border-sc-danger/20', label: 'HIGH' },
  medium: { icon: AlertTriangle, color: 'text-sc-warn', bg: 'bg-sc-warn/10', border: 'border-sc-warn/20', label: 'MEDIUM' },
  low: { icon: Info, color: 'text-sc-accent', bg: 'bg-sc-accent/10', border: 'border-sc-accent/20', label: 'LOW' },
}

export default function Analysis() {
  const { data: analysis, loading, error } = useAnalysis()
  const { data: llmConfig } = useLLMConfig()
  const { data: latestAnalysis } = useLatestAIAnalysis()
  const [aiInsights, setAIInsights] = useState(null)
  const [generating, setGenerating] = useState(false)

  // Load latest analysis on mount
  useEffect(() => {
    if (latestAnalysis?.analysis) {
      setAIInsights(latestAnalysis.analysis)
    }
  }, [latestAnalysis])

  const handleGenerateAI = async () => {
    setGenerating(true)
    try {
      const result = await generateAIAnalysis()
      setAIInsights(result.analysis)
    } catch (err) {
      alert('Failed to generate AI analysis: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="text-gray-500 font-mono text-sm p-8">Analysing fleet...</div>
  if (error) return <div className="text-sc-danger font-mono text-sm p-8">Error: {error}</div>

  const gaps = analysis?.gap_analysis || []
  const redundancies = analysis?.redundancies || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">FLEET ANALYSIS</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Gap analysis and redundancy detection
        </p>
      </div>

      <div className="glow-line" />

      {/* AI Insights Button (only if LLM configured) */}
      {llmConfig?.api_key_set && (
        <div className="flex justify-end">
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="btn-primary flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Generating AI Insights...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Insights
              </>
            )}
          </button>
        </div>
      )}

      {/* AI Insights Panel */}
      {aiInsights && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI Fleet Insights
          </div>
          <div className="p-5">
            <div className="prose prose-invert prose-sm max-w-none text-gray-300">
              <ReactMarkdown>{aiInsights}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      <div>
        <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-gray-400 mb-3">
          Role Gaps
        </h3>
        {gaps.length === 0 ? (
          <div className="panel p-6 text-center text-gray-500 text-sm">
            No significant gaps detected. Your fleet covers all major roles!
          </div>
        ) : (
          <div className="space-y-3">
            {gaps.map((gap, i) => {
              const cfg = PRIORITY_CONFIG[gap.priority] || PRIORITY_CONFIG.low
              const Icon = cfg.icon
              return (
                <div key={i} className={`panel border-l-2 ${cfg.border} overflow-hidden`}>
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 ${cfg.color} shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display font-semibold text-white">{gap.role}</span>
                          <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{gap.description}</p>
                        {gap.suggestions && gap.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {gap.suggestions.map((s, j) => (
                              <span
                                key={j}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 text-xs font-mono text-gray-300 border border-sc-border"
                              >
                                <ChevronRight className="w-3 h-3 text-sc-accent" />
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Redundancies */}
      <div>
        <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-gray-400 mb-3">
          Redundancies
        </h3>
        {redundancies.length === 0 ? (
          <div className="panel p-6 text-center text-gray-500 text-sm">
            No role redundancies detected.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {redundancies.map((group, i) => (
              <div key={i} className="panel">
                <div className="px-4 py-3 border-b border-sc-border/50 flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-sc-melt" />
                  <span className="font-display text-sm font-semibold text-white">{group.role}</span>
                  <span className="ml-auto text-xs font-mono text-gray-500">{group.ships.length} ships</span>
                </div>
                <div className="p-4 space-y-1.5">
                  {group.ships.map((ship, j) => (
                    <div key={j} className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sc-border" />
                      {ship}
                    </div>
                  ))}
                  {group.notes && (
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-sc-border/30">
                      {group.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
