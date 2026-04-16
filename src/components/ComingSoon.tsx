import type { ReactNode } from 'react'
import { Rocket, Timer, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './ComingSoon.css'

interface ComingSoonProps {
  title: string
  description: string
  icon?: ReactNode
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description, icon }) => {
  const navigate = useNavigate()

  return (
    <section className="coming-soon">
      <div className="coming-soon__icon-wrap">
        <div className="coming-soon__icon-shell">
          {icon || <Rocket size={40} className="coming-soon__icon" />}
        </div>
        <div className="coming-soon__spark">
          <Sparkles size={16} />
        </div>
      </div>

      <div className="coming-soon__content">
        <div className="coming-soon__badge">
          <Timer size={14} /> Coming Soon
        </div>

        <h1 className="coming-soon__title">{title}</h1>
        <p className="coming-soon__description">{description}</p>

        <div className="coming-soon__actions">
          <button
            onClick={() => navigate('/')}
            className="coming-soon__btn coming-soon__btn--primary"
          >
            Back to Dashboard
            <ArrowRight size={16} />
          </button>

          <button className="coming-soon__btn coming-soon__btn--secondary">
            Notify Me
          </button>
        </div>
      </div>
    </section>
  )
}
