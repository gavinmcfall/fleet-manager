import React, { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, RotateCcw, ZoomIn } from 'lucide-react'

const OUTPUT_SIZE = 512
const OUTPUT_MIME = 'image/webp'
const OUTPUT_QUALITY = 0.85

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function cropToBlob(imageSrc, pixelCrop, rotation = 0) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')

  // If rotating, translate to center of canvas, rotate, then draw centered on crop
  if (rotation !== 0) {
    const scratch = document.createElement('canvas')
    const sx = Math.max(image.width, image.height) * 2
    scratch.width = sx
    scratch.height = sx
    const sctx = scratch.getContext('2d')
    sctx.translate(sx / 2, sx / 2)
    sctx.rotate((rotation * Math.PI) / 180)
    sctx.drawImage(image, -image.width / 2, -image.height / 2)

    ctx.drawImage(
      scratch,
      (sx - image.width) / 2 + pixelCrop.x,
      (sx - image.height) / 2 + pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )
  } else {
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      OUTPUT_MIME,
      OUTPUT_QUALITY,
    )
  })
}

/**
 * Modern avatar cropping dialog.
 *
 * Props:
 *   open        — boolean
 *   file        — File (JPEG/PNG/WebP)
 *   onCancel    — () => void
 *   onSave      — (croppedFile: File, previewDataUrl: string) => void
 *   title?      — optional heading
 *   aspectRatio? — default 1 (square)
 */
export default function AvatarCropDialog({ open, file, onCancel, onSave, title = 'Crop headshot', aspectRatio = 1 }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !file) {
      setImageSrc(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setCroppedAreaPixels(null)
      setError(null)
      return
    }
    let cancelled = false
    readFileAsDataUrl(file)
      .then((src) => { if (!cancelled) setImageSrc(src) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [open, file])

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setSaving(true)
    setError(null)
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, rotation)
      const cropped = new File([blob], 'headshot.webp', { type: OUTPUT_MIME })
      const previewUrl = URL.createObjectURL(blob)
      onSave(cropped, previewUrl)
    } catch (err) {
      setError(err.message || 'Failed to crop image')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-sc-bg-secondary border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-300">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cropper canvas — square stage for 1:1 avatars */}
        <div className="relative w-full aspect-square bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              objectFit="contain"
              style={{ containerStyle: { background: '#000' } }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-3">
          <label className="flex items-center gap-3 text-xs text-gray-400">
            <ZoomIn className="w-3.5 h-3.5 shrink-0" />
            <span className="w-12 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-sc-accent cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-[11px] text-gray-500">{zoom.toFixed(2)}×</span>
          </label>

          <label className="flex items-center gap-3 text-xs text-gray-400">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="w-12 shrink-0">Rotate</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value, 10))}
              className="flex-1 accent-sc-accent cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-[11px] text-gray-500">{rotation}°</span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-gray-600">
              Exported as {OUTPUT_SIZE}×{OUTPUT_SIZE} WebP
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!croppedAreaPixels || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sc-accent/15 text-sc-accent border border-sc-accent/30 hover:bg-sc-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save headshot'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
