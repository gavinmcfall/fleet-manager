export default function EmptyState({ message, icon: Icon, large = false }) {
  if (large && Icon) {
    return (
      <div className="panel p-12 text-center">
        <Icon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    )
  }

  return (
    <div className="panel p-6 text-center text-gray-500 text-sm">
      {message}
    </div>
  )
}
