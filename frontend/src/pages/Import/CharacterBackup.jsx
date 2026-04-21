import React, { useState, useRef, useEffect } from 'react'
import { Plus, Upload, X, Image, FileText, Loader, Crop } from 'lucide-react'
import { useCharacters, uploadCharacter, deleteCharacter } from '../../hooks/useAPI'
import CharacterCard from './CharacterCard'
import ConfirmDialog from '../../components/ConfirmDialog'
import AvatarCropDialog from '../../components/AvatarCropDialog'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function CharacterBackup() {
  const { data, loading, refetch } = useCharacters()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [chfFile, setChfFile] = useState(null)
  const [headshotFile, setHeadshotFile] = useState(null)
  const [headshotPreview, setHeadshotPreview] = useState(null)
  const [headshotError, setHeadshotError] = useState(null)
  const [cropSource, setCropSource] = useState(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false })
  const chfInputRef = useRef(null)
  const headshotInputRef = useRef(null)
  const chfDropRef = useRef(0)
  const [chfDragging, setChfDragging] = useState(false)

  // Revoke any object URLs we created so we don't leak memory
  useEffect(() => {
    return () => {
      if (headshotPreview && headshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(headshotPreview)
      }
    }
  }, [headshotPreview])

  const characters = data?.characters || []

  const handleChfDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    chfDropRef.current = 0
    setChfDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.chf')) {
      setChfFile(file)
      if (!name) setName(file.name.replace('.chf', ''))
    }
  }

  const handleHeadshotSelect = (file) => {
    setHeadshotError(null)
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setHeadshotError(`Unsupported image type (${file.type || 'unknown'}). Use JPEG, PNG, or WebP.`)
      return
    }
    // No size cap — cropper downsizes to ≤ ~100KB WebP regardless of source size.
    setCropSource(file)
    setCropOpen(true)
  }

  const handleCropSave = (croppedFile, previewUrl) => {
    if (headshotPreview && headshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(headshotPreview)
    }
    setHeadshotFile(croppedFile)
    setHeadshotPreview(previewUrl)
    setCropOpen(false)
    setCropSource(null)
  }

  const handleCropCancel = () => {
    setCropOpen(false)
    setCropSource(null)
    // Clear file input so selecting the same file again re-fires onChange
    if (headshotInputRef.current) headshotInputRef.current.value = ''
  }

  const clearHeadshot = () => {
    if (headshotPreview && headshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(headshotPreview)
    }
    setHeadshotFile(null)
    setHeadshotPreview(null)
    setHeadshotError(null)
    if (headshotInputRef.current) headshotInputRef.current.value = ''
  }

  const handleSave = async () => {
    if (!name.trim() || !chfFile) return
    setUploading(true)
    setError(null)
    try {
      await uploadCharacter(name.trim(), chfFile, headshotFile)
      setAdding(false)
      resetForm()
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (character) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Character',
      message: `Delete "${character.name}"? The .chf file and headshot will be permanently removed.`,
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog({ open: false })
        try {
          await deleteCharacter(character.id)
          refetch()
        } catch { /* silent */ }
      },
    })
  }

  const resetForm = () => {
    setName('')
    setChfFile(null)
    clearHeadshot()
    setError(null)
  }

  const handleCancel = () => {
    setAdding(false)
    resetForm()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-5 h-5 text-sc-accent animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {characters.map((char, i) => (
          <CharacterCard
            key={char.id}
            character={char}
            index={i}
            onDelete={handleDelete}
          />
        ))}

        {/* Add Character card / inline form */}
        {adding ? (
          <div className="relative bg-white/[0.03] backdrop-blur-md border border-sc-accent/20 rounded-xl p-4 shadow-lg shadow-black/20 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Add Character</h3>
              <button
                onClick={handleCancel}
                className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name input */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/40 transition-colors mb-3"
              autoFocus
            />

            {/* CHF drop zone */}
            <div
              className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-200 mb-3 ${
                chfDragging
                  ? 'border-sc-accent bg-sc-accent/5'
                  : chfFile
                    ? 'border-sc-accent/30 bg-sc-accent/5'
                    : 'border-white/[0.08] hover:border-white/[0.15]'
              }`}
              onClick={() => chfInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); chfDropRef.current++; setChfDragging(true) }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); chfDropRef.current--; if (chfDropRef.current === 0) setChfDragging(false) }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={handleChfDrop}
            >
              <input
                ref={chfInputRef}
                type="file"
                accept=".chf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setChfFile(f)
                    if (!name) setName(f.name.replace('.chf', ''))
                  }
                }}
              />
              {chfFile ? (
                <div className="flex items-center justify-center gap-2 text-sc-accent text-xs">
                  <FileText className="w-4 h-4" />
                  {chfFile.name} ({(chfFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  <Upload className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                  Drop <span className="font-mono text-gray-400">.chf</span> file
                </div>
              )}
            </div>

            {/* Headshot drop zone */}
            <div className="mb-3">
              <div
                className={`p-3 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                  headshotPreview
                    ? 'border-sc-accent/20 bg-sc-accent/5'
                    : headshotError
                      ? 'border-red-400/30 bg-red-500/5'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
                onClick={() => !headshotPreview && headshotInputRef.current?.click()}
              >
                <input
                  ref={headshotInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    handleHeadshotSelect(e.target.files?.[0])
                    // reset so selecting the same file again re-fires onChange
                    e.target.value = ''
                  }}
                />
                {headshotPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={headshotPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-white/[0.08]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300">Headshot ready</p>
                      <p className="text-[10px] text-gray-600">512×512 WebP</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); headshotInputRef.current?.click() }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
                      title="Replace headshot"
                    >
                      <Crop className="w-3 h-3" /> Replace
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearHeadshot() }}
                      className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
                      title="Remove headshot"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Image className="w-4 h-4" />
                    Add headshot (optional)
                  </div>
                )}
              </div>
              {headshotError && (
                <p className="mt-1.5 text-[11px] text-red-400">{headshotError}</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3">{error}</p>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!name.trim() || !chfFile || uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sc-accent/15 text-sc-accent border border-sc-accent/30 hover:bg-sc-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Save Character
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="group relative flex flex-col items-center justify-center gap-2 p-6 bg-white/[0.02] backdrop-blur-md border-2 border-dashed border-white/[0.06] rounded-xl text-gray-500 hover:text-sc-accent hover:border-sc-accent/20 hover:bg-sc-accent/5 transition-all duration-200 cursor-pointer animate-stagger-fade-up min-h-[140px]"
            style={{ animationDelay: `${Math.min(characters.length * 50, 400)}ms` }}
          >
            <div className="p-3 rounded-full bg-white/[0.04] group-hover:bg-sc-accent/10 transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Add Character</span>
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog({ open: false })}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
      />

      <AvatarCropDialog
        open={cropOpen}
        file={cropSource}
        onCancel={handleCropCancel}
        onSave={handleCropSave}
      />
    </>
  )
}
