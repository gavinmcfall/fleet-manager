import { AlertCircle } from 'lucide-react'

export default function ErrorState({ message, onRetry }) {
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
