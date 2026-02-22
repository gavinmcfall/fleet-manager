export default function PageHeader({ title, subtitle, actions, divider = true }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">{title}</h2>
          {subtitle && <p className="text-xs font-mono text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {divider && <div className="glow-line" />}
    </>
  )
}
