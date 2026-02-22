export default function LoadingState({ message = 'Loading...', fullScreen = false, variant = 'spinner' }) {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="skeleton h-8 w-48 rounded" />
        {/* Bento grid skeleton */}
        <div className="bento-grid">
          {/* Hero card — spans 2 cols */}
          <div className="panel col-span-2 p-6 space-y-3">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-12 w-40 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          {/* Ship count */}
          <div className="panel p-5 space-y-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-9 w-14 rounded" />
          </div>
          {/* Cargo */}
          <div className="panel p-5 space-y-3">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-9 w-20 rounded" />
          </div>
          {/* Min Crew */}
          <div className="panel p-5 space-y-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-8 w-10 rounded" />
          </div>
          {/* Max Crew */}
          <div className="panel p-5 space-y-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-8 w-10 rounded" />
          </div>
          {/* Fleet Health — spans 2 cols */}
          <div className="panel col-span-2 p-5 space-y-3">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-1.5 w-full rounded-full" />
            <div className="skeleton h-1.5 w-full rounded-full" />
          </div>
        </div>
        {/* Chart panels skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel p-4">
            <div className="skeleton h-4 w-32 rounded mb-4" />
            <div className="skeleton h-48 rounded" />
          </div>
          <div className="panel p-4">
            <div className="skeleton h-4 w-32 rounded mb-4" />
            <div className="skeleton h-48 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'h-64'}`} role="status" aria-live="polite">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-sc-accent border-t-transparent rounded-full animate-spin mb-4" aria-hidden="true"></div>
        <p className="text-sm font-mono text-gray-400">{message}</p>
      </div>
    </div>
  )
}
