import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-sc-panel border border-sc-border rounded pl-10 pr-4 py-2 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/50"
      />
    </div>
  )
}
