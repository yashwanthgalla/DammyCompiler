interface ProgressBarProps {
  solved: number
  total: number
  className?: string
}

export const ProgressBar = ({ solved, total, className = '' }: ProgressBarProps) => {
  const percentage = total === 0 ? 0 : Math.round((solved / total) * 100)

  return (
    <div className={className} style={{ width: '100%', height: '4px', borderRadius: '999px', background: '#e8e8e8', overflow: 'hidden' }}>
      <div
        style={{ width: `${percentage}%`, height: '100%', background: '#1a1a1a', borderRadius: '999px', transition: 'width 0.3s ease' }}
      />
    </div>
  )
}
