const variantStyles = {
  info: { border: 'border-l-sc-accent', iconColor: 'text-sc-accent' },
  success: { border: 'border-l-sc-success', iconColor: 'text-sc-success' },
  error: { border: 'border-l-sc-danger', iconColor: 'text-sc-danger' },
  warning: { border: 'border-l-sc-warn', iconColor: 'text-sc-warn' },
}

export default function AlertBanner({ variant = 'info', icon: Icon, children }) {
  const styles = variantStyles[variant] || variantStyles.info

  return (
    <div className={`panel p-4 flex items-start gap-3 border-l-2 ${styles.border}`}>
      {Icon && <Icon className={`w-4 h-4 ${styles.iconColor} shrink-0 mt-0.5`} />}
      <div className="flex-1">{children}</div>
    </div>
  )
}
