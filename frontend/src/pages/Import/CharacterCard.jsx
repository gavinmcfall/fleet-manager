import React from 'react'
import { Download, Trash2, User } from 'lucide-react'
import { formatDate } from '../../lib/dates'

export default function CharacterCard({ character, index = 0, onDelete }) {
  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/characters/${character.id}/chf`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${character.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.chf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    }
  }

  return (
    <div
      className="group relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20 transition-all duration-200 hover:border-sc-accent/30 hover:shadow-sc-accent/10 hover:shadow-xl animate-stagger-fade-up"
      style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
    >
      {/* HUD corner brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-sc-accent/0 group-hover:border-sc-accent/30 transition-colors duration-200 rounded-br-xl" />

      <div className="flex gap-4">
        {/* Headshot */}
        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          {character.headshot_key ? (
            <img
              src={`/api/characters/${character.id}/headshot`}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-gray-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
            {character.name}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(character.created_at)}
          </p>
          {character.file_size && (
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">
              {(character.file_size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-sc-accent hover:bg-sc-accent/10 border border-white/[0.06] hover:border-sc-accent/20 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          onClick={() => onDelete?.(character)}
          className="flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 transition-all cursor-pointer"
          title="Delete character"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
