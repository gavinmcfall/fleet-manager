import { useState } from 'react'
import { Rocket } from 'lucide-react'

const ASPECT_CLASSES = {
  landscape: 'aspect-video',
  square: 'aspect-square',
  thumbnail: 'w-20 h-12',
}

export default function ShipImage({ src, alt, aspectRatio = 'landscape', hoverZoom = false, className = '' }) {
  const [status, setStatus] = useState(src ? 'loading' : 'error')

  const aspectClass = ASPECT_CLASSES[aspectRatio] || ASPECT_CLASSES.landscape
  const isFixedSize = aspectRatio === 'thumbnail'

  return (
    <div className={`relative overflow-hidden bg-sc-darker/50 ${isFixedSize ? aspectClass : `w-full ${aspectClass}`} ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 skeleton" />
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-sc-darker/50" role="img" aria-label={alt ? `${alt} — image unavailable` : 'Ship image unavailable'}>
          <Rocket className={`text-sc-border/60 ${isFixedSize ? 'w-5 h-5' : 'w-8 h-8'}`} aria-hidden="true" />
        </div>
      )}

      {src && status !== 'error' && (
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-300 ${
            status === 'loading' ? 'opacity-0' : 'opacity-100'
          } ${hoverZoom ? 'group-hover:scale-105' : ''}`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  )
}
