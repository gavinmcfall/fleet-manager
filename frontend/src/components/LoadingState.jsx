export default function LoadingState({ message = 'Loading...', fullScreen = false }) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'h-64'}`}>
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-sc-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-mono text-gray-500">{message}</p>
      </div>
    </div>
  )
}
