export default function ErrorState({ message }) {
  return (
    <div className="text-sc-danger font-mono text-sm p-8">Error: {message}</div>
  )
}
