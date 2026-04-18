import { AlertCircle, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ErrorState({ message, onRetry, notFound }) {
  const isNotFound = notFound ?? (typeof message === 'string' && /not found/i.test(message))

  if (isNotFound) {
    return (
      <div className="panel p-12 text-center space-y-4 animate-fade-in">
        <Compass className="w-14 h-14 text-gray-600 mx-auto" />
        <h2 className="text-lg font-medium text-gray-300">Lost in the verse</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          We couldn't find what you were looking for. It may have been renamed, moved, or never existed.
        </p>
        <Link to="/" className="btn-primary inline-block mt-2">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="panel p-8 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-sc-danger shrink-0 mt-0.5" />
        <div>
          <p className="text-sc-danger font-mono text-sm">Error: {message}</p>
          {onRetry && (
            <button onClick={onRetry} className="btn-secondary mt-3 text-xs">
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
