export default function PanelSection({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className={`panel-header${Icon ? ' flex items-center gap-2' : ''}`}>
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
