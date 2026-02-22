import { Link } from 'react-router-dom'

export default function EmptyState({ message, icon: Icon, large = false, action, actionLink }) {
  if (large && Icon) {
    return (
      <div className="panel p-12 text-center animate-fade-in">
        <Icon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
        <p className="text-gray-500 text-base">{message}</p>
        {action && (
          <button onClick={action.onClick} className="btn-primary mt-4">
            {action.label}
          </button>
        )}
        {actionLink && (
          <Link to={actionLink.to} className="btn-primary inline-block mt-4">
            {actionLink.label}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="panel p-6 text-center text-gray-500 text-base animate-fade-in">
      {message}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-3 mx-auto block">
          {action.label}
        </button>
      )}
      {actionLink && (
        <Link to={actionLink.to} className="btn-primary inline-block mt-3">
          {actionLink.label}
        </Link>
      )}
    </div>
  )
}
