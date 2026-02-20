export default function StatCard({ icon: Icon, label, value, color = 'text-white', accentBorder }) {
  return (
    <div className={`stat-card${accentBorder ? ` border-l-2 ${accentBorder}` : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${accentBorder ? color : 'text-gray-600'}`} />
        <span className="stat-label">{label}</span>
      </div>
      <span className={`stat-value ${color}`}>{value}</span>
    </div>
  )
}
