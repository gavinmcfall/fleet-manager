export default function StatCard({ icon: Icon, label, value, color = 'text-white', accentBorder }) {
  return (
    <div className={`stat-card hover:border-sc-accent/20 hover:-translate-y-0.5${accentBorder ? ` border-l-2 ${accentBorder}` : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accentBorder ? color : 'text-gray-500'}`} />
        <span className="stat-label">{label}</span>
      </div>
      <span className={`stat-value ${color}`}>{value}</span>
    </div>
  )
}
